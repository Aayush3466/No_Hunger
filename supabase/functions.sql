-- =============================================================================
-- NoHunger — 03_functions.sql
-- Every atomic, race-sensitive or privacy-sensitive operation lives here.
-- Run AFTER policies.sql. Safe to re-run.
--
-- Naming: functions prefixed nh_ are internal (no EXECUTE grant to clients).
-- Everything without the prefix is the public RPC surface.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create or replace function public.nh_config_int(p_key text, p_default integer)
returns integer
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce((select (value #>> '{}')::integer from public.app_config where key = p_key), p_default);
$$;

-- Great-circle distance in km. IMMUTABLE so it can sit in an index expression
-- and be inlined by the planner. Deliberately no PostGIS: the free tier does
-- not need the extension for a neighbourhood-radius query.
create or replace function public.nh_haversine_km(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
returns double precision
language sql
immutable
parallel safe
as $$
  select 6371.0088 * 2 * asin(
    sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2)
      + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
    )
  );
$$;

-- Single definition of what a donation's status should be, given its numbers.
-- Every path that moves servings calls this instead of hand-writing the rule.
create or replace function public.nh_derive_donation_status(
  p_remaining integer,
  p_total integer,
  p_expires timestamptz
)
returns public.donation_status
language sql
stable
as $$
  select case
    when p_remaining <= 0      then 'completed'::public.donation_status
    when p_expires <= now()    then 'expired'::public.donation_status
    when p_remaining < p_total then 'partially_claimed'::public.donation_status
    else 'available'::public.donation_status
  end;
$$;

create or replace function public.nh_notify(
  p_user_id uuid,
  p_type public.notification_type,
  p_payload jsonb
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.notifications (user_id, type, payload)
  values (p_user_id, p_type, coalesce(p_payload, '{}'::jsonb));
$$;

-- Queue a photo for deletion, but only once the listing can no longer be shown
-- and no order still needs it. Storage deletion itself happens in
-- /api/gc/images with the service-role key, because SQL cannot call Storage.
create or replace function public.nh_enqueue_image_gc(p_donation_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_don public.donations%rowtype;
  v_active integer;
begin
  select * into v_don from public.donations where id = p_donation_id;
  if not found or v_don.image_path is null then
    return;
  end if;

  select count(*) into v_active
  from public.requests
  where donation_id = p_donation_id and status in ('pending', 'accepted');

  if v_active > 0 then
    return;
  end if;

  if v_don.status in ('completed', 'expired', 'cancelled') or v_don.servings_remaining <= 0 then
    insert into public.storage_gc (bucket, path) values ('food-images', v_don.image_path);
    update public.donations set image_path = null where id = p_donation_id;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Triggers: validation the client cannot skip
-- -----------------------------------------------------------------------------

create or replace function public.nh_validate_donation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_max_hours integer := public.nh_config_int('max_expiry_hours', 48);
  v_min_mins  integer := public.nh_config_int('min_expiry_minutes', 15);
begin
  if new.expires_at < now() + make_interval(mins => v_min_mins) then
    raise exception 'EXPIRY_TOO_SOON' using errcode = '22023';
  end if;
  if new.expires_at > now() + make_interval(hours => v_max_hours) then
    raise exception 'EXPIRY_TOO_FAR' using errcode = '22023';
  end if;
  new.food_name := btrim(new.food_name);
  return new;
end;
$$;

drop trigger if exists donations_validate on public.donations;
create trigger donations_validate
  before insert on public.donations
  for each row execute function public.nh_validate_donation();

-- A donor editing their listing must not be able to move servings or status.
-- Those only move inside the SECURITY DEFINER functions below, which run with
-- session_user = the function owner rather than 'authenticated'.
create or replace function public.nh_guard_donation_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- current_user is 'authenticated' for a direct client UPDATE, and the
  -- function owner (postgres) inside any SECURITY DEFINER function. That is
  -- exactly the distinction we need, and unlike the `role` GUC it is not
  -- inherited into definer functions.
  if current_user in ('authenticated', 'anon') then
    if new.servings_remaining is distinct from old.servings_remaining then
      raise exception 'SERVINGS_ARE_SERVER_MANAGED' using errcode = '42501';
    end if;
    -- The one status change a donor may make directly is withdrawing a listing.
    if new.status is distinct from old.status and new.status <> 'cancelled' then
      raise exception 'STATUS_IS_SERVER_MANAGED' using errcode = '42501';
    end if;
    if new.total_servings is distinct from old.total_servings then
      raise exception 'TOTAL_SERVINGS_IMMUTABLE' using errcode = '42501';
    end if;
    if new.donor_id is distinct from old.donor_id then
      raise exception 'DONOR_IMMUTABLE' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists donations_guard_update on public.donations;
create trigger donations_guard_update
  before update on public.donations
  for each row execute function public.nh_guard_donation_update();

create or replace function public.nh_guard_rating()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_receiver uuid;
  v_donor    uuid;
  v_status   public.request_status;
begin
  select r.receiver_id, d.donor_id, r.status
    into v_receiver, v_donor, v_status
  from public.requests r
  join public.donations d on d.id = r.donation_id
  where r.id = new.request_id;

  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_status <> 'completed' then
    raise exception 'ORDER_NOT_COMPLETED' using errcode = '22023';
  end if;
  if new.rater_id not in (v_receiver, v_donor) or new.ratee_id not in (v_receiver, v_donor) then
    raise exception 'NOT_A_PARTY' using errcode = '42501';
  end if;
  if new.rater_id = new.ratee_id then
    raise exception 'NO_SELF_RATING' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists ratings_guard on public.ratings;
create trigger ratings_guard
  before insert on public.ratings
  for each row execute function public.nh_guard_rating();

-- =============================================================================
-- THE map read path. One source of truth.
-- Parameterized rather than a plain view because delivery radius and viewport
-- both need the viewer's own position. The client never filters status itself.
-- =============================================================================
create or replace function public.get_available_donations(
  p_center_lat  double precision,
  p_center_lng  double precision,
  p_radius_km   double precision default 5,
  p_categories  public.donation_category[] default null,
  p_food_types  public.food_type[] default null,
  p_min_servings integer default 1,
  p_mode        public.request_mode default null,
  p_limit       integer default 100
)
returns table (
  id                 uuid,
  donor_id           uuid,
  donor_name         text,
  donor_avatar_url   text,
  donor_avg_rating   numeric,
  donor_ratings_count integer,
  food_name          text,
  description        text,
  category           public.donation_category,
  food_type          public.food_type,
  allergens          text,
  image_path         text,
  total_servings     integer,
  servings_remaining integer,
  pickup_lat         double precision,
  pickup_lng         double precision,
  pickup_address     text,
  fulfilment_mode    public.fulfilment_mode,
  delivery_radius_km numeric,
  expires_at         timestamptz,
  created_at         timestamptz,
  distance_km        double precision,
  delivery_available boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    d.id,
    d.donor_id,
    p.full_name,
    p.avatar_url,
    s.donor_avg_rating,
    s.donor_ratings_count,
    d.food_name,
    d.description,
    d.category,
    d.food_type,
    d.allergens,
    d.image_path,
    d.total_servings,
    d.servings_remaining,
    d.pickup_lat,
    d.pickup_lng,
    d.pickup_address,
    d.fulfilment_mode,
    d.delivery_radius_km,
    d.expires_at,
    d.created_at,
    dist.km as distance_km,
    (d.fulfilment_mode in ('delivery', 'both')
      and d.delivery_radius_km is not null
      and dist.km <= d.delivery_radius_km) as delivery_available
  from public.donations d
  join public.profiles p on p.id = d.donor_id
  left join public.profile_stats s on s.user_id = d.donor_id
  cross join lateral (
    select public.nh_haversine_km(p_center_lat, p_center_lng, d.pickup_lat, d.pickup_lng) as km
  ) dist
  where
    -- Liveness. Enforced here, server-side, always.
    d.status in ('available', 'partially_claimed')
    and d.expires_at > now()
    and d.servings_remaining > 0
    -- Viewport / radius
    and dist.km <= greatest(p_radius_km, 0.1)
    -- Filters
    and (p_categories is null or d.category = any (p_categories))
    and (p_food_types is null or d.food_type = any (p_food_types))
    and d.servings_remaining >= greatest(coalesce(p_min_servings, 1), 1)
    and (
      p_mode is null
      or (p_mode = 'pickup' and d.fulfilment_mode in ('pickup', 'both'))
      or (p_mode = 'delivery'
          and d.fulfilment_mode in ('delivery', 'both')
          and d.delivery_radius_km is not null
          and dist.km <= d.delivery_radius_km)
    )
    -- Blocking is real: hidden in both directions.
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = (select auth.uid()) and b.blocked_id = d.donor_id)
         or (b.blocker_id = d.donor_id and b.blocked_id = (select auth.uid()))
    )
  order by dist.km asc
  limit least(coalesce(p_limit, 100), 200);
$$;

-- Single listing, same liveness rule, for the detail sheet.
create or replace function public.get_donation(
  p_donation_id uuid,
  p_center_lat double precision default null,
  p_center_lng double precision default null
)
returns table (
  id                 uuid,
  donor_id           uuid,
  donor_name         text,
  donor_avatar_url   text,
  donor_avg_rating   numeric,
  donor_ratings_count integer,
  food_name          text,
  description        text,
  category           public.donation_category,
  food_type          public.food_type,
  allergens          text,
  image_path         text,
  total_servings     integer,
  servings_remaining integer,
  pickup_lat         double precision,
  pickup_lng         double precision,
  pickup_address     text,
  fulfilment_mode    public.fulfilment_mode,
  delivery_radius_km numeric,
  expires_at         timestamptz,
  created_at         timestamptz,
  distance_km        double precision,
  delivery_available boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    d.id, d.donor_id, p.full_name, p.avatar_url, s.donor_avg_rating, s.donor_ratings_count,
    d.food_name, d.description, d.category, d.food_type, d.allergens, d.image_path,
    d.total_servings, d.servings_remaining, d.pickup_lat, d.pickup_lng, d.pickup_address,
    d.fulfilment_mode, d.delivery_radius_km, d.expires_at, d.created_at,
    case when p_center_lat is null then null
         else public.nh_haversine_km(p_center_lat, p_center_lng, d.pickup_lat, d.pickup_lng) end,
    (d.fulfilment_mode in ('delivery', 'both')
      and d.delivery_radius_km is not null
      and p_center_lat is not null
      and public.nh_haversine_km(p_center_lat, p_center_lng, d.pickup_lat, d.pickup_lng)
          <= d.delivery_radius_km)
  from public.donations d
  join public.profiles p on p.id = d.donor_id
  left join public.profile_stats s on s.user_id = d.donor_id
  where d.id = p_donation_id
    and d.status in ('available', 'partially_claimed')
    and d.expires_at > now()
    and d.servings_remaining > 0
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = (select auth.uid()) and b.blocked_id = d.donor_id)
         or (b.blocker_id = d.donor_id and b.blocked_id = (select auth.uid()))
    );
$$;

-- =============================================================================
-- Requesting
-- =============================================================================
create or replace function public.create_request(
  p_donation_id     uuid,
  p_servings        integer,
  p_mode            public.request_mode,
  p_dropoff_lat     double precision default null,
  p_dropoff_lng     double precision default null,
  p_dropoff_address text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_don       public.donations%rowtype;
  v_request_id uuid;
  v_recent    integer;
  v_limit     integer := public.nh_config_int('max_requests_per_hour', 20);
  v_distance  double precision;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_servings is null or p_servings < 1 then
    raise exception 'INVALID_SERVINGS' using errcode = '22023';
  end if;

  select count(*) into v_recent
  from public.requests
  where receiver_id = v_uid and created_at > now() - interval '1 hour';

  if v_recent >= v_limit then
    raise exception 'RATE_LIMITED' using errcode = '53400';
  end if;

  -- Lock so the servings check cannot race an accept happening right now.
  select * into v_don from public.donations where id = p_donation_id for update;
  if not found then
    raise exception 'DONATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_don.donor_id = v_uid then
    raise exception 'CANNOT_REQUEST_OWN_FOOD' using errcode = '22023';
  end if;
  if v_don.status not in ('available', 'partially_claimed') then
    raise exception 'DONATION_UNAVAILABLE' using errcode = '22023';
  end if;
  if v_don.expires_at <= now() then
    raise exception 'DONATION_EXPIRED' using errcode = '22023';
  end if;
  if p_servings > v_don.servings_remaining then
    raise exception 'NOT_ENOUGH_SERVINGS' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.blocks b
    where (b.blocker_id = v_uid and b.blocked_id = v_don.donor_id)
       or (b.blocker_id = v_don.donor_id and b.blocked_id = v_uid)
  ) then
    raise exception 'BLOCKED' using errcode = '42501';
  end if;

  -- Mode has to be one the donor actually offers.
  if p_mode = 'pickup' and v_don.fulfilment_mode = 'delivery' then
    raise exception 'MODE_NOT_OFFERED' using errcode = '22023';
  end if;
  if p_mode = 'delivery' then
    if v_don.fulfilment_mode = 'pickup' then
      raise exception 'MODE_NOT_OFFERED' using errcode = '22023';
    end if;
    if p_dropoff_lat is null or p_dropoff_lng is null then
      raise exception 'DROPOFF_REQUIRED' using errcode = '22023';
    end if;
    v_distance := public.nh_haversine_km(
      v_don.pickup_lat, v_don.pickup_lng, p_dropoff_lat, p_dropoff_lng);
    if v_don.delivery_radius_km is null or v_distance > v_don.delivery_radius_km then
      raise exception 'OUTSIDE_DELIVERY_RADIUS' using errcode = '22023';
    end if;
  end if;

  insert into public.requests (donation_id, receiver_id, servings_requested, fulfilment_mode)
  values (p_donation_id, v_uid, p_servings, p_mode)
  returning id into v_request_id;

  if p_mode = 'delivery' then
    insert into public.delivery_details (request_id, dropoff_lat, dropoff_lng, dropoff_address)
    values (v_request_id, p_dropoff_lat, p_dropoff_lng, left(p_dropoff_address, 240));
  end if;

  perform public.nh_notify(
    v_don.donor_id,
    'request_created',
    jsonb_build_object(
      'request_id', v_request_id,
      'donation_id', p_donation_id,
      'food_name', v_don.food_name,
      'servings', p_servings,
      'mode', p_mode
    )
  );

  return v_request_id;
exception
  when unique_violation then
    raise exception 'ALREADY_REQUESTED' using errcode = '23505';
end;
$$;

-- =============================================================================
-- Accepting — the atomic, race-safe claim.
-- Two simultaneous accepts of the last serving: the second one blocks on the
-- donation row lock, then fails the re-check and rolls back whole.
-- =============================================================================
create or replace function public.accept_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_req       public.requests%rowtype;
  v_don       public.donations%rowtype;
  v_remaining integer;
  v_stranded  record;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into v_req from public.requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Serialization point. Everything after this is single-file per donation.
  select * into v_don from public.donations where id = v_req.donation_id for update;

  if v_don.donor_id <> v_uid then
    raise exception 'NOT_DONOR' using errcode = '42501';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'REQUEST_NOT_PENDING' using errcode = '22023';
  end if;
  if v_don.expires_at <= now() then
    raise exception 'DONATION_EXPIRED' using errcode = '22023';
  end if;
  if v_don.status not in ('available', 'partially_claimed') then
    raise exception 'DONATION_UNAVAILABLE' using errcode = '22023';
  end if;
  if v_don.servings_remaining < v_req.servings_requested then
    raise exception 'NOT_ENOUGH_SERVINGS' using errcode = '22023';
  end if;

  update public.donations
     set servings_remaining = servings_remaining - v_req.servings_requested,
         status = public.nh_derive_donation_status(
                    servings_remaining - v_req.servings_requested,
                    total_servings,
                    expires_at)
   where id = v_don.id
   returning servings_remaining into v_remaining;

  update public.requests
     set status = 'accepted', accepted_at = now()
   where id = p_request_id;

  perform public.nh_notify(
    v_req.receiver_id,
    'request_accepted',
    jsonb_build_object(
      'request_id', v_req.id,
      'donation_id', v_don.id,
      'food_name', v_don.food_name,
      'servings', v_req.servings_requested
    )
  );

  -- Nothing left: strand nobody. Auto-reject the rest inside this same
  -- transaction so a receiver never stares at a request that can never be met.
  if v_remaining = 0 then
    for v_stranded in
      update public.requests
         set status = 'rejected'
       where donation_id = v_don.id and status = 'pending'
      returning id, receiver_id
    loop
      delete from public.delivery_details where request_id = v_stranded.id;
      perform public.nh_notify(
        v_stranded.receiver_id,
        'request_auto_rejected',
        jsonb_build_object(
          'request_id', v_stranded.id,
          'donation_id', v_don.id,
          'food_name', v_don.food_name,
          'reason', 'fully_claimed'
        )
      );
    end loop;
  end if;

  return jsonb_build_object(
    'request_id', v_req.id,
    'donation_id', v_don.id,
    'servings_remaining', v_remaining,
    'donation_status', public.nh_derive_donation_status(
      v_remaining, v_don.total_servings, v_don.expires_at)
  );
end;
$$;

create or replace function public.reject_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_req public.requests%rowtype;
  v_don public.donations%rowtype;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into v_req from public.requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  select * into v_don from public.donations where id = v_req.donation_id;
  if v_don.donor_id <> v_uid then
    raise exception 'NOT_DONOR' using errcode = '42501';
  end if;

  -- Idempotent: rejecting an already-rejected request is a no-op, not an error.
  if v_req.status = 'rejected' then
    return jsonb_build_object('request_id', v_req.id, 'status', 'rejected', 'noop', true);
  end if;
  if v_req.status <> 'pending' then
    raise exception 'REQUEST_NOT_PENDING' using errcode = '22023';
  end if;

  update public.requests set status = 'rejected' where id = p_request_id;
  delete from public.delivery_details where request_id = p_request_id;

  perform public.nh_notify(
    v_req.receiver_id,
    'request_rejected',
    jsonb_build_object('request_id', v_req.id, 'donation_id', v_don.id, 'food_name', v_don.food_name)
  );

  return jsonb_build_object('request_id', v_req.id, 'status', 'rejected', 'noop', false);
end;
$$;

-- =============================================================================
-- Release: the ONE place servings come back. Used by donor cancel, receiver
-- cancel and the timeout sweeper, so the three paths cannot drift apart.
-- least(total, remaining + requested) makes overshoot impossible even if this
-- somehow ran twice.
-- =============================================================================
create or replace function public.nh_release_request(
  p_request_id uuid,
  p_new_status public.request_status,
  p_reason     text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_req       public.requests%rowtype;
  v_don       public.donations%rowtype;
  v_remaining integer;
begin
  select * into v_req from public.requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_don from public.donations where id = v_req.donation_id for update;

  if v_req.status = 'accepted' then
    update public.donations
       set servings_remaining = least(total_servings, servings_remaining + v_req.servings_requested)
     where id = v_don.id
     returning servings_remaining into v_remaining;

    update public.donations
       set status = case
                      when status = 'cancelled' then 'cancelled'
                      else public.nh_derive_donation_status(v_remaining, total_servings, expires_at)
                    end
     where id = v_don.id;
  else
    v_remaining := v_don.servings_remaining;
  end if;

  update public.requests
     set status = p_new_status,
         cancel_reason = left(p_reason, 200)
   where id = p_request_id;

  -- Revoke everything the order was allowed to expose.
  delete from public.live_locations where request_id = p_request_id;
  delete from public.delivery_details where request_id = p_request_id;

  perform public.nh_enqueue_image_gc(v_don.id);

  return jsonb_build_object(
    'request_id', p_request_id,
    'donation_id', v_don.id,
    'servings_remaining', v_remaining
  );
end;
$$;

create or replace function public.cancel_request(
  p_request_id uuid,
  p_reason     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_req   public.requests%rowtype;
  v_don   public.donations%rowtype;
  v_other uuid;
  v_out   jsonb;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into v_req from public.requests where id = p_request_id;
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  select * into v_don from public.donations where id = v_req.donation_id;

  if v_uid not in (v_req.receiver_id, v_don.donor_id) then
    raise exception 'NOT_A_PARTY' using errcode = '42501';
  end if;

  -- Idempotent by design: a double tap, or both parties cancelling at once,
  -- must not restore servings twice.
  if v_req.status in ('cancelled', 'rejected', 'completed') then
    return jsonb_build_object('request_id', v_req.id, 'status', v_req.status, 'noop', true);
  end if;

  v_out := public.nh_release_request(p_request_id, 'cancelled', p_reason);

  v_other := case when v_uid = v_req.receiver_id then v_don.donor_id else v_req.receiver_id end;
  perform public.nh_notify(
    v_other,
    'request_cancelled',
    jsonb_build_object(
      'request_id', v_req.id,
      'donation_id', v_don.id,
      'food_name', v_don.food_name,
      'cancelled_by', v_uid,
      'reason', p_reason
    )
  );

  return v_out || jsonb_build_object('status', 'cancelled', 'noop', false);
end;
$$;

-- =============================================================================
-- Completion — PHASE 3 UI, but the function ships now so the SQL is run once.
-- Idempotent: a simultaneous double-confirm is harmless.
-- =============================================================================
create or replace function public.complete_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_req   public.requests%rowtype;
  v_don   public.donations%rowtype;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into v_req from public.requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  select * into v_don from public.donations where id = v_req.donation_id for update;

  if v_uid not in (v_req.receiver_id, v_don.donor_id) then
    raise exception 'NOT_A_PARTY' using errcode = '42501';
  end if;
  if v_req.status = 'completed' then
    return jsonb_build_object('request_id', v_req.id, 'status', 'completed', 'noop', true);
  end if;
  if v_req.status <> 'accepted' then
    raise exception 'ORDER_NOT_ACTIVE' using errcode = '22023';
  end if;

  -- Whoever is travelling confirms: donor for delivery, receiver for pickup.
  if v_req.fulfilment_mode = 'pickup' and v_uid <> v_don.donor_id then
    raise exception 'DONOR_CONFIRMS_PICKUP' using errcode = '42501';
  end if;
  if v_req.fulfilment_mode = 'delivery' and v_uid <> v_req.receiver_id then
    raise exception 'RECEIVER_CONFIRMS_DELIVERY' using errcode = '42501';
  end if;

  update public.requests
     set status = 'completed', completed_at = now()
   where id = p_request_id;

  -- Servings are NOT restored: the food actually changed hands.
  delete from public.live_locations where request_id = p_request_id;
  delete from public.delivery_details where request_id = p_request_id;

  update public.donations
     set status = case
                    when status = 'cancelled' then 'cancelled'
                    else public.nh_derive_donation_status(servings_remaining, total_servings, expires_at)
                  end
   where id = v_don.id;

  perform public.nh_enqueue_image_gc(v_don.id);

  perform public.nh_notify(v_req.receiver_id, 'order_completed',
    jsonb_build_object('request_id', v_req.id, 'donation_id', v_don.id, 'food_name', v_don.food_name));
  perform public.nh_notify(v_don.donor_id, 'order_completed',
    jsonb_build_object('request_id', v_req.id, 'donation_id', v_don.id, 'food_name', v_don.food_name));

  return jsonb_build_object('request_id', v_req.id, 'status', 'completed', 'noop', false);
end;
$$;

-- =============================================================================
-- Contact + address reveal. State-gated, never duplicated onto the order row.
-- Returns nothing once the order stops being 'accepted'.
-- =============================================================================
create or replace function public.get_order_details(p_request_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_req   public.requests%rowtype;
  v_don   public.donations%rowtype;
  v_other uuid;
  v_prof  public.profiles%rowtype;
  v_dd    public.delivery_details%rowtype;
  v_out   jsonb;
begin
  if v_uid is null then
    return null;
  end if;

  select * into v_req from public.requests where id = p_request_id;
  if not found then
    return null;
  end if;
  select * into v_don from public.donations where id = v_req.donation_id;

  if v_uid not in (v_req.receiver_id, v_don.donor_id) then
    return null;
  end if;
  if v_req.status <> 'accepted' then
    return null;  -- completed or cancelled: access is gone.
  end if;

  v_other := case when v_uid = v_req.receiver_id then v_don.donor_id else v_req.receiver_id end;
  select * into v_prof from public.profiles where id = v_other;

  v_out := jsonb_build_object(
    'request_id', v_req.id,
    'donation_id', v_don.id,
    'role', case when v_uid = v_don.donor_id then 'donor' else 'receiver' end,
    'mode', v_req.fulfilment_mode,
    'food_name', v_don.food_name,
    'servings', v_req.servings_requested,
    'accepted_at', v_req.accepted_at,
    'pickup', jsonb_build_object(
      'lat', v_don.pickup_lat, 'lng', v_don.pickup_lng, 'address', v_don.pickup_address),
    'counterpart', jsonb_build_object(
      'id', v_prof.id,
      'full_name', v_prof.full_name,
      'avatar_url', v_prof.avatar_url,
      'phone', v_prof.phone)
  );

  -- Delivery: the matched donor additionally gets the precise dropoff point.
  if v_req.fulfilment_mode = 'delivery' then
    select * into v_dd from public.delivery_details where request_id = v_req.id;
    if found then
      v_out := v_out || jsonb_build_object(
        'dropoff', jsonb_build_object(
          'lat', v_dd.dropoff_lat, 'lng', v_dd.dropoff_lng, 'address', v_dd.dropoff_address));
    end if;
  end if;

  return v_out;
end;
$$;

-- =============================================================================
-- Inbox / order list helpers (one round trip instead of three)
-- =============================================================================
create or replace function public.get_incoming_requests()
returns table (
  request_id         uuid,
  donation_id        uuid,
  food_name          text,
  servings_requested integer,
  fulfilment_mode    public.request_mode,
  status             public.request_status,
  created_at         timestamptz,
  servings_remaining integer,
  expires_at         timestamptz,
  receiver_id        uuid,
  receiver_name      text,
  receiver_avatar_url text,
  receiver_avg_rating numeric,
  receiver_ratings_count integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    r.id, d.id, d.food_name, r.servings_requested, r.fulfilment_mode, r.status, r.created_at,
    d.servings_remaining, d.expires_at,
    p.id, p.full_name, p.avatar_url, s.receiver_avg_rating, s.receiver_ratings_count
  from public.requests r
  join public.donations d on d.id = r.donation_id
  join public.profiles p on p.id = r.receiver_id
  left join public.profile_stats s on s.user_id = r.receiver_id
  where d.donor_id = (select auth.uid())
    and r.status in ('pending', 'accepted')
  order by r.created_at desc
  limit 100;
$$;

create or replace function public.get_my_requests()
returns table (
  request_id         uuid,
  donation_id        uuid,
  food_name          text,
  servings_requested integer,
  fulfilment_mode    public.request_mode,
  status             public.request_status,
  created_at         timestamptz,
  expires_at         timestamptz,
  pickup_lat         double precision,
  pickup_lng         double precision,
  donor_id           uuid,
  donor_name         text,
  donor_avatar_url   text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    r.id, d.id, d.food_name, r.servings_requested, r.fulfilment_mode, r.status, r.created_at,
    d.expires_at, d.pickup_lat, d.pickup_lng, p.id, p.full_name, p.avatar_url
  from public.requests r
  join public.donations d on d.id = r.donation_id
  join public.profiles p on p.id = d.donor_id
  where r.receiver_id = (select auth.uid())
    and r.status in ('pending', 'accepted')
  order by r.created_at desc
  limit 100;
$$;

-- =============================================================================
-- Housekeeping, called by pg_cron (see cron.sql)
-- =============================================================================

-- Flips open listings past their expiry. Deliberately does NOT touch accepted
-- requests: a receiver may already be walking over.
create or replace function public.expire_donations()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer := 0;
  v_row   record;
begin
  for v_row in
    update public.donations
       set status = 'expired'
     where status in ('available', 'partially_claimed')
       and expires_at <= now()
    returning id, donor_id, food_name
  loop
    v_count := v_count + 1;

    -- Pending requests on expired food can never be met. Close them out.
    declare
      v_pending record;
    begin
      for v_pending in
        update public.requests
           set status = 'rejected'
         where donation_id = v_row.id and status = 'pending'
        returning id, receiver_id
      loop
        delete from public.delivery_details where request_id = v_pending.id;
        perform public.nh_notify(
          v_pending.receiver_id,
          'request_auto_rejected',
          jsonb_build_object('request_id', v_pending.id, 'donation_id', v_row.id,
                             'food_name', v_row.food_name, 'reason', 'expired'));
      end loop;
    end;

    perform public.nh_enqueue_image_gc(v_row.id);
  end loop;

  return v_count;
end;
$$;

-- Accepted-but-never-completed orders auto-cancel after the configured window
-- and put the servings back on the map.
create or replace function public.timeout_stale_orders()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_minutes integer := public.nh_config_int('accepted_order_timeout_minutes', 90);
  v_count   integer := 0;
  v_row     record;
  v_donor   uuid;
begin
  for v_row in
    select r.id, r.receiver_id, d.donor_id, d.food_name, d.id as donation_id
    from public.requests r
    join public.donations d on d.id = r.donation_id
    where r.status = 'accepted'
      and r.accepted_at < now() - make_interval(mins => v_minutes)
    for update of r
  loop
    perform public.nh_release_request(v_row.id, 'cancelled', 'auto_cancelled_timeout');
    v_count := v_count + 1;

    perform public.nh_notify(v_row.receiver_id, 'order_timed_out',
      jsonb_build_object('request_id', v_row.id, 'donation_id', v_row.donation_id,
                         'food_name', v_row.food_name));
    perform public.nh_notify(v_row.donor_id, 'order_timed_out',
      jsonb_build_object('request_id', v_row.id, 'donation_id', v_row.donation_id,
                         'food_name', v_row.food_name));
  end loop;

  return v_count;
end;
$$;

-- live_locations are ephemeral. Anything left behind by a dropped connection
-- or an order that ended without a clean teardown goes here.
create or replace function public.purge_stale_live_locations()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ttl integer := public.nh_config_int('live_location_ttl_minutes', 30);
  v_count integer;
begin
  with gone as (
    delete from public.live_locations l
    where l.updated_at < now() - make_interval(mins => v_ttl)
       or not exists (
         select 1 from public.requests r
         where r.id = l.request_id and r.status = 'accepted'
       )
    returning 1
  )
  select count(*) into v_count from gone;
  return v_count;
end;
$$;

-- Belt-and-braces: catch any image on a terminal donation that never got queued.
create or replace function public.sweep_orphan_images()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row   record;
  v_count integer := 0;
begin
  for v_row in
    select id from public.donations
    where image_path is not null
      and (status in ('completed', 'expired', 'cancelled') or servings_remaining <= 0)
      and not exists (
        select 1 from public.requests r
        where r.donation_id = donations.id and r.status in ('pending', 'accepted')
      )
    limit 200
  loop
    perform public.nh_enqueue_image_gc(v_row.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- =============================================================================
-- EXECUTE grants. Postgres grants EXECUTE to PUBLIC by default, so revoke first
-- and then hand out exactly what each role needs.
-- =============================================================================
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

-- Public read path: anonymous visitors can browse the map.
grant execute on function public.get_available_donations(
  double precision, double precision, double precision,
  public.donation_category[], public.food_type[], integer, public.request_mode, integer
) to anon, authenticated;

grant execute on function public.get_donation(uuid, double precision, double precision)
  to anon, authenticated;

grant execute on function public.nh_haversine_km(
  double precision, double precision, double precision, double precision
) to anon, authenticated;

-- Signed-in actions.
grant execute on function public.create_request(
  uuid, integer, public.request_mode, double precision, double precision, text
) to authenticated;
grant execute on function public.accept_request(uuid)   to authenticated;
grant execute on function public.reject_request(uuid)   to authenticated;
grant execute on function public.cancel_request(uuid, text) to authenticated;
grant execute on function public.complete_request(uuid) to authenticated;
grant execute on function public.get_order_details(uuid) to authenticated;
grant execute on function public.get_incoming_requests() to authenticated;
grant execute on function public.get_my_requests()       to authenticated;

-- Housekeeping stays with the service role / cron only. No client grants:
--   expire_donations, timeout_stale_orders, purge_stale_live_locations,
--   sweep_orphan_images, nh_release_request, nh_notify, nh_enqueue_image_gc.
