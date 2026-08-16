-- =============================================================================
-- NoHunger — 01_schema.sql
-- Tables, enums, constraints, indexes, views, column-level privileges.
-- Run this FIRST, in the Supabase SQL editor.
-- Safe to re-run: everything is guarded with IF NOT EXISTS / OR REPLACE.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.donation_category as enum ('veg', 'non_veg', 'vegan');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.food_type as enum ('cooked', 'packaged');
exception when duplicate_object then null; end $$;

-- What the donor offers.
do $$ begin
  create type public.fulfilment_mode as enum ('pickup', 'delivery', 'both');
exception when duplicate_object then null; end $$;

-- What the receiver picked. Deliberately a separate type: a request can never be 'both'.
do $$ begin
  create type public.request_mode as enum ('pickup', 'delivery');
exception when duplicate_object then null; end $$;

-- Governs the LISTING lifecycle. Never used to gate contact reveal or tracking.
do $$ begin
  create type public.donation_status as enum
    ('available', 'partially_claimed', 'completed', 'expired', 'cancelled');
exception when duplicate_object then null; end $$;

-- Governs a single ORDER. This is what gates tracking, contact and address reveal.
do $$ begin
  create type public.request_status as enum
    ('pending', 'accepted', 'rejected', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_type as enum (
    'request_created',
    'request_accepted',
    'request_rejected',
    'request_cancelled',
    'request_auto_rejected',
    'order_completed',
    'order_timed_out',
    'rating_received'
  );
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- profiles
-- `phone` is never selectable by anon/authenticated (see column grants at the
-- bottom of this file). It only ever leaves the database through
-- public.get_order_details(), which is state-gated.
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  full_name            text not null default '',
  avatar_url           text,
  phone                text,
  usual_donation_times text,
  bio                  text,
  onboarded_at         timestamptz,
  created_at           timestamptz not null default now(),
  constraint profiles_full_name_len check (char_length(full_name) <= 80),
  constraint profiles_phone_shape   check (phone is null or phone ~ '^\+?[0-9 ()-]{6,20}$'),
  constraint profiles_bio_len       check (bio is null or char_length(bio) <= 400)
);

-- -----------------------------------------------------------------------------
-- app_config — small key/value table so timeouts are configurable without a deploy
-- -----------------------------------------------------------------------------
create table if not exists public.app_config (
  key   text primary key,
  value jsonb not null
);

insert into public.app_config (key, value) values
  ('accepted_order_timeout_minutes', '90'::jsonb),
  ('max_requests_per_hour',          '20'::jsonb),
  ('max_reports_per_day',            '10'::jsonb),
  ('max_expiry_hours',               '48'::jsonb),
  ('min_expiry_minutes',             '15'::jsonb),
  ('live_location_ttl_minutes',      '30'::jsonb)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- donations
-- -----------------------------------------------------------------------------
create table if not exists public.donations (
  id                 uuid primary key default gen_random_uuid(),
  donor_id           uuid not null references public.profiles (id) on delete cascade,
  food_name          text not null,
  description        text,
  category           public.donation_category not null,
  food_type          public.food_type not null,
  allergens          text,
  image_path         text,
  total_servings     integer not null,
  servings_remaining integer not null,
  pickup_lat         double precision not null,
  pickup_lng         double precision not null,
  pickup_address     text,
  fulfilment_mode    public.fulfilment_mode not null default 'pickup',
  delivery_radius_km numeric(5, 2),
  expires_at         timestamptz not null,
  status             public.donation_status not null default 'available',
  created_at         timestamptz not null default now(),

  constraint donations_food_name_len   check (char_length(food_name) between 2 and 80),
  constraint donations_desc_len        check (description is null or char_length(description) <= 500),
  constraint donations_allergens_len   check (allergens is null or char_length(allergens) <= 200),
  constraint donations_total_bounds    check (total_servings between 1 and 500),
  constraint donations_remaining_bounds check (servings_remaining between 0 and total_servings),
  constraint donations_lat_range       check (pickup_lat between -90 and 90),
  constraint donations_lng_range       check (pickup_lng between -180 and 180),
  constraint donations_radius_shape    check (
    (fulfilment_mode = 'pickup' and delivery_radius_km is null)
    or (fulfilment_mode in ('delivery', 'both') and delivery_radius_km is not null
        and delivery_radius_km between 0.5 and 50)
  )
);

-- The map read path always filters on these three together.
create index if not exists donations_live_idx
  on public.donations (status, expires_at)
  where status in ('available', 'partially_claimed');

create index if not exists donations_bbox_idx on public.donations (pickup_lat, pickup_lng);
create index if not exists donations_donor_idx on public.donations (donor_id, created_at desc);
create index if not exists donations_expiry_idx on public.donations (expires_at);

-- -----------------------------------------------------------------------------
-- requests
-- -----------------------------------------------------------------------------
create table if not exists public.requests (
  id                 uuid primary key default gen_random_uuid(),
  donation_id        uuid not null references public.donations (id) on delete cascade,
  receiver_id        uuid not null references public.profiles (id) on delete cascade,
  servings_requested integer not null,
  fulfilment_mode    public.request_mode not null,
  status             public.request_status not null default 'pending',
  cancel_reason      text,
  created_at         timestamptz not null default now(),
  accepted_at        timestamptz,
  completed_at       timestamptz,

  constraint requests_servings_bounds check (servings_requested between 1 and 500),
  constraint requests_cancel_reason_len check (cancel_reason is null or char_length(cancel_reason) <= 200)
);

-- One live request per (donation, receiver). Blocks double-claiming structurally.
create unique index if not exists requests_one_active_per_pair_idx
  on public.requests (donation_id, receiver_id)
  where status in ('pending', 'accepted');

create index if not exists requests_donation_idx on public.requests (donation_id, status);
create index if not exists requests_receiver_idx on public.requests (receiver_id, created_at desc);
create index if not exists requests_accepted_idx on public.requests (accepted_at)
  where status = 'accepted';
create index if not exists requests_rate_limit_idx on public.requests (receiver_id, created_at desc);

-- -----------------------------------------------------------------------------
-- delivery_details
-- Its own table because RLS is row-level, not column-level. This is the only
-- clean way to keep the receiver's precise dropoff address away from the donor
-- until the order is accepted. Row is deleted the moment the order ends.
-- -----------------------------------------------------------------------------
create table if not exists public.delivery_details (
  request_id     uuid primary key references public.requests (id) on delete cascade,
  dropoff_lat    double precision not null,
  dropoff_lng    double precision not null,
  dropoff_address text,
  constraint delivery_lat_range check (dropoff_lat between -90 and 90),
  constraint delivery_lng_range check (dropoff_lng between -180 and 180),
  constraint delivery_address_len check (dropoff_address is null or char_length(dropoff_address) <= 240)
);

-- -----------------------------------------------------------------------------
-- ratings
-- -----------------------------------------------------------------------------
create table if not exists public.ratings (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  rater_id   uuid not null references public.profiles (id) on delete cascade,
  ratee_id   uuid not null references public.profiles (id) on delete cascade,
  stars      smallint not null,
  comment    text,
  created_at timestamptz not null default now(),

  constraint ratings_stars_range check (stars between 1 and 5),
  constraint ratings_no_self     check (rater_id <> ratee_id),
  constraint ratings_comment_len check (comment is null or char_length(comment) <= 400),
  constraint ratings_one_per_rater unique (request_id, rater_id)
);

create index if not exists ratings_ratee_idx on public.ratings (ratee_id);

-- -----------------------------------------------------------------------------
-- live_locations — ephemeral, wiped when an order ends
-- -----------------------------------------------------------------------------
create table if not exists public.live_locations (
  request_id uuid not null references public.requests (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  lat        double precision not null,
  lng        double precision not null,
  updated_at timestamptz not null default now(),
  primary key (request_id, user_id),
  constraint live_lat_range check (lat between -90 and 90),
  constraint live_lng_range check (lng between -180 and 180)
);

-- -----------------------------------------------------------------------------
-- notifications
-- -----------------------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       public.notification_type not null,
  payload    jsonb not null default '{}'::jsonb,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (user_id) where read = false;

-- -----------------------------------------------------------------------------
-- reports / blocks
-- -----------------------------------------------------------------------------
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_id uuid not null references public.profiles (id) on delete cascade,
  request_id  uuid references public.requests (id) on delete set null,
  reason      text not null,
  created_at  timestamptz not null default now(),
  constraint reports_no_self check (reporter_id <> reported_id),
  constraint reports_reason_len check (char_length(reason) between 3 and 500)
);

create index if not exists reports_reporter_idx on public.reports (reporter_id, created_at desc);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_no_self check (blocker_id <> blocked_id)
);

create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

-- -----------------------------------------------------------------------------
-- storage_gc — Postgres cannot delete Storage objects itself, so terminal paths
-- enqueue here and /api/gc/images drains the queue with the service-role key.
-- -----------------------------------------------------------------------------
create table if not exists public.storage_gc (
  id          bigint generated always as identity primary key,
  bucket      text not null,
  path        text not null,
  enqueued_at timestamptz not null default now(),
  deleted_at  timestamptz,
  attempts    integer not null default 0,
  last_error  text
);

create index if not exists storage_gc_pending_idx
  on public.storage_gc (enqueued_at) where deleted_at is null;

-- -----------------------------------------------------------------------------
-- push_subscriptions — PHASE 4 (Web Push). Table lands now so the schema is
-- stable; nothing writes to it until Step D.
-- -----------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- -----------------------------------------------------------------------------
-- Auto-create a profile row for every new auth user
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Views
-- -----------------------------------------------------------------------------

-- Safe, public-readable slice of a profile. Never includes phone.
create or replace view public.public_profiles
with (security_invoker = on) as
select
  p.id,
  p.full_name,
  p.avatar_url,
  p.usual_donation_times,
  p.bio,
  p.created_at
from public.profiles p;

-- Role-split stats. A rating's role is derived by joining request -> donation:
-- if the ratee is the donation's donor it is a donor rating, otherwise a
-- receiver rating.
--
-- This view is intentionally NOT security_invoker: donor ratings have to be
-- visible to a receiver deciding whether to claim food, and requests/ratings
-- RLS is per-row. It exposes aggregates only, no identifying detail.
create or replace view public.profile_stats
with (security_invoker = off) as
select
  p.id as user_id,
  coalesce(donor.servings, 0)::int      as donor_servings_total,
  coalesce(donor.donations, 0)::int     as donor_donations_count,
  donor_r.avg_stars                     as donor_avg_rating,
  coalesce(donor_r.count, 0)::int       as donor_ratings_count,
  coalesce(recv.servings, 0)::int       as receiver_servings_total,
  coalesce(recv.receipts, 0)::int       as receiver_receipts_count,
  recv_r.avg_stars                      as receiver_avg_rating,
  coalesce(recv_r.count, 0)::int        as receiver_ratings_count,
  p.usual_donation_times
from public.profiles p
left join lateral (
  select sum(r.servings_requested) as servings, count(distinct r.donation_id) as donations
  from public.requests r
  join public.donations d on d.id = r.donation_id
  where d.donor_id = p.id and r.status = 'completed'
) donor on true
left join lateral (
  select sum(r.servings_requested) as servings, count(*) as receipts
  from public.requests r
  where r.receiver_id = p.id and r.status = 'completed'
) recv on true
left join lateral (
  select round(avg(rt.stars)::numeric, 2) as avg_stars, count(*) as count
  from public.ratings rt
  join public.requests r on r.id = rt.request_id
  join public.donations d on d.id = r.donation_id
  where rt.ratee_id = p.id and d.donor_id = p.id
) donor_r on true
left join lateral (
  select round(avg(rt.stars)::numeric, 2) as avg_stars, count(*) as count
  from public.ratings rt
  join public.requests r on r.id = rt.request_id
  where rt.ratee_id = p.id and r.receiver_id = p.id
) recv_r on true;

-- -----------------------------------------------------------------------------
-- Column-level privileges
-- RLS is row-level. `phone` needs to be hidden at the COLUMN level, so it is
-- revoked from every client role. get_order_details() is SECURITY DEFINER and
-- is the only way it ever reaches a client.
-- -----------------------------------------------------------------------------
revoke all on public.profiles from anon, authenticated;
grant select (id, full_name, avatar_url, usual_donation_times, bio, onboarded_at, created_at)
  on public.profiles to anon, authenticated;
grant insert (id, full_name, avatar_url, phone, usual_donation_times, bio, onboarded_at)
  on public.profiles to authenticated;
grant update (full_name, avatar_url, phone, usual_donation_times, bio, onboarded_at)
  on public.profiles to authenticated;

grant select on public.public_profiles to anon, authenticated;
grant select on public.profile_stats  to anon, authenticated;

grant select on public.donations to anon, authenticated;
grant insert, update on public.donations to authenticated;

grant select, insert, update on public.requests to authenticated;
grant select on public.delivery_details to authenticated;
grant insert on public.delivery_details to authenticated;
grant select, insert on public.ratings to authenticated;
grant select, insert, update, delete on public.live_locations to authenticated;
grant select, update on public.notifications to authenticated;
grant insert on public.reports to authenticated;
grant select, insert, delete on public.blocks to authenticated;
grant select, insert, delete on public.push_subscriptions to authenticated;
grant select on public.app_config to anon, authenticated;

-- storage_gc is service-role only. No grants to client roles at all.
revoke all on public.storage_gc from anon, authenticated;
