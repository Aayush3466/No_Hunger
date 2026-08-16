-- =============================================================================
-- NoHunger — 02_policies.sql
-- Row Level Security. Run AFTER schema.sql.
-- Safe to re-run: every policy is dropped before it is created.
--
-- Reading rule of thumb:
--   * anon can read the live map and public profile fields. Nothing else.
--   * authenticated can read/write only its own rows, plus rows of an order it
--     is a party to.
--   * every state change that has to be atomic or that reveals private data
--     goes through a SECURITY DEFINER function in functions.sql, not through
--     these policies.
-- =============================================================================

alter table public.profiles           enable row level security;
alter table public.donations          enable row level security;
alter table public.requests           enable row level security;
alter table public.delivery_details   enable row level security;
alter table public.ratings            enable row level security;
alter table public.live_locations     enable row level security;
alter table public.notifications      enable row level security;
alter table public.reports            enable row level security;
alter table public.blocks             enable row level security;
alter table public.storage_gc         enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.app_config         enable row level security;

-- -----------------------------------------------------------------------------
-- profiles
-- Row-level: everyone may read every profile row.
-- Column-level (schema.sql) is what keeps `phone` private.
-- -----------------------------------------------------------------------------
drop policy if exists profiles_select_all on public.profiles;
create policy profiles_select_all on public.profiles
  for select to anon, authenticated
  using (true);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- app_config — read-only reference data
-- -----------------------------------------------------------------------------
drop policy if exists app_config_select on public.app_config;
create policy app_config_select on public.app_config
  for select to anon, authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- donations
--
-- The SELECT policy repeats the liveness rule that get_available_donations()
-- enforces. That redundancy is deliberate: it is what makes a completed or
-- expired listing unreachable even if a client queries the table directly, and
-- it is also what Realtime evaluates before delivering a change event.
-- -----------------------------------------------------------------------------
drop policy if exists donations_select_live_or_involved on public.donations;
create policy donations_select_live_or_involved on public.donations
  for select to anon, authenticated
  using (
    (status in ('available', 'partially_claimed')
      and expires_at > now()
      and servings_remaining > 0)
    or donor_id = (select auth.uid())
    or exists (
      select 1 from public.requests r
      where r.donation_id = donations.id
        and r.receiver_id = (select auth.uid())
    )
  );

drop policy if exists donations_insert_own on public.donations;
create policy donations_insert_own on public.donations
  for insert to authenticated
  with check (
    donor_id = (select auth.uid())
    and servings_remaining = total_servings
    and status = 'available'
    and expires_at > now()
  );

-- A donor may only edit descriptive fields of their own listing. Servings and
-- status are moved exclusively by the SECURITY DEFINER functions; the trigger
-- nh_guard_donation_update() in functions.sql enforces that.
drop policy if exists donations_update_own on public.donations;
create policy donations_update_own on public.donations
  for update to authenticated
  using (donor_id = (select auth.uid()))
  with check (donor_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- requests
-- Visible to the receiver who made it and to the donor who owns the donation.
-- Inserts and status changes go through create_request/accept_request/etc.
-- -----------------------------------------------------------------------------
drop policy if exists requests_select_party on public.requests;
create policy requests_select_party on public.requests
  for select to authenticated
  using (
    receiver_id = (select auth.uid())
    or exists (
      select 1 from public.donations d
      where d.id = requests.donation_id
        and d.donor_id = (select auth.uid())
    )
  );

-- No direct INSERT policy on purpose: create_request() is the only way in.
-- No direct UPDATE policy on purpose: accept/reject/cancel/complete own it.

-- -----------------------------------------------------------------------------
-- delivery_details
-- Receiver-only direct read. The matched donor never reads this table; they get
-- the address through get_order_details() while the order is accepted.
-- -----------------------------------------------------------------------------
drop policy if exists delivery_details_select_receiver on public.delivery_details;
create policy delivery_details_select_receiver on public.delivery_details
  for select to authenticated
  using (
    exists (
      select 1 from public.requests r
      where r.id = delivery_details.request_id
        and r.receiver_id = (select auth.uid())
    )
  );

drop policy if exists delivery_details_insert_receiver on public.delivery_details;
create policy delivery_details_insert_receiver on public.delivery_details
  for insert to authenticated
  with check (
    exists (
      select 1 from public.requests r
      where r.id = delivery_details.request_id
        and r.receiver_id = (select auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- ratings
-- Readable by anyone (they drive public trust), written only by a party to a
-- completed order. nh_guard_rating() does the hard checks.
-- -----------------------------------------------------------------------------
drop policy if exists ratings_select_all on public.ratings;
create policy ratings_select_all on public.ratings
  for select to anon, authenticated
  using (true);

drop policy if exists ratings_insert_party on public.ratings;
create policy ratings_insert_party on public.ratings
  for insert to authenticated
  with check (
    rater_id = (select auth.uid())
    and exists (
      select 1
      from public.requests r
      join public.donations d on d.id = r.donation_id
      where r.id = ratings.request_id
        and r.status = 'completed'
        and (select auth.uid()) in (r.receiver_id, d.donor_id)
        and ratings.ratee_id in (r.receiver_id, d.donor_id)
    )
  );

-- -----------------------------------------------------------------------------
-- live_locations
-- Both parties of an ACCEPTED order can read each other. Nobody else, ever.
-- Note this gates on request.status, never on donation.status.
-- -----------------------------------------------------------------------------
drop policy if exists live_locations_select_party on public.live_locations;
create policy live_locations_select_party on public.live_locations
  for select to authenticated
  using (
    exists (
      select 1
      from public.requests r
      join public.donations d on d.id = r.donation_id
      where r.id = live_locations.request_id
        and r.status = 'accepted'
        and (select auth.uid()) in (r.receiver_id, d.donor_id)
    )
  );

drop policy if exists live_locations_write_own on public.live_locations;
create policy live_locations_write_own on public.live_locations
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.requests r
      join public.donations d on d.id = r.donation_id
      where r.id = live_locations.request_id
        and r.status = 'accepted'
        and (select auth.uid()) in (r.receiver_id, d.donor_id)
    )
  );

drop policy if exists live_locations_update_own on public.live_locations;
create policy live_locations_update_own on public.live_locations
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists live_locations_delete_own on public.live_locations;
create policy live_locations_delete_own on public.live_locations
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- notifications — read and mark-as-read your own only
-- -----------------------------------------------------------------------------
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- reports — write-only from the client's point of view
-- -----------------------------------------------------------------------------
drop policy if exists reports_insert_own on public.reports;
create policy reports_insert_own on public.reports
  for insert to authenticated
  with check (reporter_id = (select auth.uid()));

drop policy if exists reports_select_own on public.reports;
create policy reports_select_own on public.reports
  for select to authenticated
  using (reporter_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- blocks
-- -----------------------------------------------------------------------------
drop policy if exists blocks_select_own on public.blocks;
create policy blocks_select_own on public.blocks
  for select to authenticated
  using (blocker_id = (select auth.uid()));

drop policy if exists blocks_insert_own on public.blocks;
create policy blocks_insert_own on public.blocks
  for insert to authenticated
  with check (blocker_id = (select auth.uid()));

drop policy if exists blocks_delete_own on public.blocks;
create policy blocks_delete_own on public.blocks
  for delete to authenticated
  using (blocker_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- push_subscriptions — PHASE 4
-- -----------------------------------------------------------------------------
drop policy if exists push_subscriptions_all_own on public.push_subscriptions;
create policy push_subscriptions_all_own on public.push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- storage_gc — no policies at all. RLS is on and nothing is granted, so only
-- the service role (which bypasses RLS) can touch it.
-- -----------------------------------------------------------------------------
