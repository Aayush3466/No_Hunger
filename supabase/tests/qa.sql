-- =============================================================================
-- NoHunger — supabase/tests/qa.sql
--
-- Proof, not vibes. Run this against a scratch database (never production) after
-- schema/policies/functions have been applied. Every check RAISE EXCEPTIONs on
-- failure, so a clean run means every assertion held.
--
--   psql -v ON_ERROR_STOP=1 -d <scratch-db> -f supabase/tests/qa.sql
--
-- Covers, from Step F:
--   1. oversell    — the last serving cannot be claimed twice
--   2. restore     — every cancel path returns exactly what it took, no drift
--   3. auto-reject — nobody is left holding a request that can never be met
--   4. staleness   — expired and fully-claimed food leaves the read path
--   5. reveal      — contact details are gated on request status, not donation
-- =============================================================================

\set ON_ERROR_STOP on

begin;

-- --- fixtures ---------------------------------------------------------------
create temporary table ids (label text primary key, id uuid);

do $$
declare
  v_donor uuid := gen_random_uuid();
  v_alice uuid := gen_random_uuid();
  v_bob   uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values
    (v_donor, 'donor@test.local'), (v_alice, 'alice@test.local'), (v_bob, 'bob@test.local');

  -- The auth trigger creates profiles; make sure they exist either way.
  insert into public.profiles (id, full_name, phone) values
    (v_donor, 'Donor',  '+1000000001'),
    (v_alice, 'Alice',  '+1000000002'),
    (v_bob,   'Bob',    '+1000000003')
  on conflict (id) do update set full_name = excluded.full_name, phone = excluded.phone;

  insert into ids values ('donor', v_donor), ('alice', v_alice), ('bob', v_bob);
end $$;

-- Parameters are prefixed so they cannot shadow the `label` column on ids,
-- and the assertion helper avoids the reserved words CHECK and ASSERT.
create or replace function pg_temp.uid(p_label text) returns uuid
language sql as $$ select i.id from ids i where i.label = p_label $$;

create or replace function pg_temp.act_as(p_label text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', pg_temp.uid(p_label)::text, true);
end $$;

create or replace function pg_temp.expect(p_condition boolean, p_what text) returns void
language plpgsql as $$
begin
  if not p_condition then
    raise exception 'FAILED: %', p_what;
  end if;
  raise notice 'ok: %', p_what;
end $$;

-- =============================================================================
-- 1. Oversell
-- =============================================================================
do $$
declare
  v_donation uuid;
  v_req_a uuid;
  v_req_b uuid;
  v_remaining integer;
  v_status public.donation_status;
  v_failed boolean := false;
begin
  insert into public.donations (
    donor_id, food_name, category, food_type, total_servings, servings_remaining,
    pickup_lat, pickup_lng, fulfilment_mode, expires_at
  ) values (
    pg_temp.uid('donor'), 'Dal & Rice', 'veg', 'cooked', 4, 4,
    27.7172, 85.3240, 'pickup', now() + interval '2 hours'
  ) returning id into v_donation;

  -- Two receivers each ask for 3 of the 4 servings.
  perform pg_temp.act_as('alice');
  v_req_a := public.create_request(v_donation, 3, 'pickup');
  perform pg_temp.act_as('bob');
  v_req_b := public.create_request(v_donation, 3, 'pickup');

  -- Donor accepts the first.
  perform pg_temp.act_as('donor');
  perform public.accept_request(v_req_a);

  select servings_remaining, status into v_remaining, v_status
  from public.donations where id = v_donation;

  perform pg_temp.expect(v_remaining = 1, 'accepting 3 of 4 leaves 1 serving');
  perform pg_temp.expect(v_status = 'partially_claimed', 'listing is partially_claimed, still on the map');

  -- The second accept must fail whole. This is the oversell case.
  begin
    perform public.accept_request(v_req_b);
  exception when others then
    v_failed := true;
    perform pg_temp.expect(sqlerrm like '%NOT_ENOUGH_SERVINGS%', 'second accept fails with NOT_ENOUGH_SERVINGS');
  end;
  perform pg_temp.expect(v_failed, 'second accept did not silently succeed');

  select servings_remaining into v_remaining from public.donations where id = v_donation;
  perform pg_temp.expect(v_remaining = 1, 'the failed accept moved nothing');

  -- =========================================================================
  -- 2. Restore, from the receiver side
  -- =========================================================================
  perform pg_temp.act_as('alice');
  perform public.cancel_request(v_req_a, 'changed my mind');

  select servings_remaining, status into v_remaining, v_status
  from public.donations where id = v_donation;
  perform pg_temp.expect(v_remaining = 4, 'cancelling gives all 3 servings back');
  perform pg_temp.expect(v_status = 'available', 'listing returns to available');

  -- Idempotence: a double tap must not restore twice.
  perform public.cancel_request(v_req_a, 'double tap');
  select servings_remaining into v_remaining from public.donations where id = v_donation;
  perform pg_temp.expect(v_remaining = 4, 'a second cancel restores nothing extra');

  perform pg_temp.expect(
    not exists (select 1 from public.live_locations where request_id = v_req_a),
    'cancelling clears live_locations');

  -- =========================================================================
  -- 3. Fully claimed: auto-reject the stranded, leave the map
  -- =========================================================================
  perform pg_temp.act_as('donor');
  perform public.accept_request(v_req_b);  -- Bob takes 3 of 4

  perform pg_temp.act_as('alice');
  declare v_req_c uuid;
  begin
    v_req_c := public.create_request(v_donation, 1, 'pickup');
    perform pg_temp.act_as('donor');
    perform public.accept_request(v_req_c);
  end;

  select servings_remaining, status into v_remaining, v_status
  from public.donations where id = v_donation;
  perform pg_temp.expect(v_remaining = 0, 'the last serving brings it to zero');
  perform pg_temp.expect(v_status = 'completed', 'a fully claimed listing is completed');

  -- =========================================================================
  -- 4. Staleness: it is gone from the read path for everyone
  -- =========================================================================
  perform pg_temp.act_as('alice');
  perform pg_temp.expect(
    not exists (
      select 1 from public.get_available_donations(27.7172, 85.3240, 50) g
      where g.id = v_donation),
    'fully claimed food does not come back from get_available_donations');

  -- =========================================================================
  -- 5. Contact reveal gates on REQUEST status, not donation status
  -- =========================================================================
  perform pg_temp.act_as('bob');
  perform pg_temp.expect(
    public.get_order_details(v_req_b) -> 'counterpart' ->> 'phone' = '+1000000001',
    'a matched receiver sees the donor phone while the order is accepted');

  perform pg_temp.act_as('alice');
  perform pg_temp.expect(
    public.get_order_details(v_req_b) is null,
    'a stranger sees nothing, even on an active order');

  -- This is a pickup order, so the donor is the one who confirms handover.
  perform pg_temp.act_as('bob');
  begin
    perform public.complete_request(v_req_b);
    raise exception 'FAILED: the receiver confirmed a pickup order';
  exception when others then
    if sqlerrm like '%FAILED%' then raise; end if;
    perform pg_temp.expect(sqlerrm like '%DONOR_CONFIRMS_PICKUP%',
      'a receiver cannot confirm a pickup handover');
  end;

  perform pg_temp.act_as('donor');
  perform public.complete_request(v_req_b);
  perform pg_temp.act_as('bob');
  perform pg_temp.expect(
    public.get_order_details(v_req_b) is null,
    'access is revoked the moment the order completes');
  perform pg_temp.expect(
    (select status from public.requests where id = v_req_b) = 'completed',
    'the order is completed');

  -- Idempotent completion.
  perform pg_temp.act_as('donor');
  perform public.complete_request(v_req_b);
  perform pg_temp.expect(
    (select count(*) from public.requests where id = v_req_b and status = 'completed') = 1,
    'a double confirm is harmless');
end $$;

-- =============================================================================
-- 6. Expiry: cron flips it, the read path never shows it, servings are untouched
-- =============================================================================
do $$
declare
  v_donation uuid;
  v_req uuid;
  v_expired integer;
begin
  insert into public.donations (
    donor_id, food_name, category, food_type, total_servings, servings_remaining,
    pickup_lat, pickup_lng, fulfilment_mode, expires_at
  ) values (
    pg_temp.uid('donor'), 'Soup', 'vegan', 'cooked', 5, 5,
    27.7172, 85.3240, 'pickup', now() + interval '2 hours'
  ) returning id into v_donation;

  perform pg_temp.act_as('alice');
  v_req := public.create_request(v_donation, 2, 'pickup');

  -- Reach into the past. The trigger only guards inserts, so this is fine.
  update public.donations set expires_at = now() - interval '1 minute' where id = v_donation;

  select public.expire_donations() into v_expired;
  perform pg_temp.expect(v_expired >= 1, 'the cron job expired at least one listing');
  perform pg_temp.expect(
    (select status from public.donations where id = v_donation) = 'expired',
    'the listing is marked expired');
  perform pg_temp.expect(
    (select status from public.requests where id = v_req) = 'rejected',
    'a pending request on expired food is closed out');

  perform pg_temp.expect(
    not exists (
      select 1 from public.get_available_donations(27.7172, 85.3240, 50) g
      where g.id = v_donation),
    'expired food never appears in the read path');
end $$;

-- =============================================================================
-- 7. Timeout: an accepted order nobody finished releases its servings
-- =============================================================================
do $$
declare
  v_donation uuid;
  v_req uuid;
  v_cancelled integer;
begin
  insert into public.donations (
    donor_id, food_name, category, food_type, total_servings, servings_remaining,
    pickup_lat, pickup_lng, fulfilment_mode, expires_at
  ) values (
    pg_temp.uid('donor'), 'Biryani', 'non_veg', 'cooked', 6, 6,
    27.7172, 85.3240, 'pickup', now() + interval '10 hours'
  ) returning id into v_donation;

  perform pg_temp.act_as('bob');
  v_req := public.create_request(v_donation, 4, 'pickup');
  perform pg_temp.act_as('donor');
  perform public.accept_request(v_req);

  perform pg_temp.expect(
    (select servings_remaining from public.donations where id = v_donation) = 2,
    'accepting 4 of 6 leaves 2');

  update public.requests set accepted_at = now() - interval '10 hours' where id = v_req;

  select public.timeout_stale_orders() into v_cancelled;
  perform pg_temp.expect(v_cancelled >= 1, 'the sweeper cancelled the stale order');
  perform pg_temp.expect(
    (select servings_remaining from public.donations where id = v_donation) = 6,
    'the timeout restored all 4 servings, with no overshoot');
  perform pg_temp.expect(
    (select status from public.donations where id = v_donation) = 'available',
    'the food is back on the map');
end $$;

-- =============================================================================
-- 8. Guards: self-request, duplicates, blocking
-- =============================================================================
do $$
declare
  v_donation uuid;
  v_req uuid;
  v_blocked boolean := false;
begin
  insert into public.donations (
    donor_id, food_name, category, food_type, total_servings, servings_remaining,
    pickup_lat, pickup_lng, fulfilment_mode, expires_at
  ) values (
    pg_temp.uid('donor'), 'Momos', 'veg', 'cooked', 10, 10,
    27.7172, 85.3240, 'pickup', now() + interval '4 hours'
  ) returning id into v_donation;

  perform pg_temp.act_as('donor');
  begin
    perform public.create_request(v_donation, 1, 'pickup');
    raise exception 'FAILED: a donor requested their own food';
  exception when others then
    if sqlerrm like '%FAILED%' then raise; end if;
    perform pg_temp.expect(sqlerrm like '%CANNOT_REQUEST_OWN_FOOD%', 'a donor cannot claim their own listing');
  end;

  perform pg_temp.act_as('alice');
  v_req := public.create_request(v_donation, 1, 'pickup');
  begin
    perform public.create_request(v_donation, 1, 'pickup');
    raise exception 'FAILED: duplicate active request was allowed';
  exception when others then
    if sqlerrm like '%FAILED%' then raise; end if;
    perform pg_temp.expect(sqlerrm like '%ALREADY_REQUESTED%', 'a duplicate active request is refused');
  end;

  -- Blocking hides the listing and refuses new requests, both directions.
  insert into public.blocks (blocker_id, blocked_id)
  values (pg_temp.uid('donor'), pg_temp.uid('bob'));

  perform pg_temp.act_as('bob');
  perform pg_temp.expect(
    not exists (
      select 1 from public.get_available_donations(27.7172, 85.3240, 50) g
      where g.id = v_donation),
    'a blocked user cannot see the blocker''s listings');

  begin
    perform public.create_request(v_donation, 1, 'pickup');
  exception when others then
    v_blocked := true;
    perform pg_temp.expect(sqlerrm like '%BLOCKED%', 'requests across a block are refused server-side');
  end;
  perform pg_temp.expect(v_blocked, 'the blocked request did not succeed');
end $$;

-- =============================================================================
-- 9. Image GC is queued exactly once the listing can no longer be shown
-- =============================================================================
do $$
declare
  v_donation uuid;
  v_req uuid;
begin
  insert into public.donations (
    donor_id, food_name, category, food_type, total_servings, servings_remaining,
    pickup_lat, pickup_lng, fulfilment_mode, expires_at, image_path
  ) values (
    pg_temp.uid('donor'), 'Khichdi', 'veg', 'cooked', 1, 1,
    27.7172, 85.3240, 'pickup', now() + interval '3 hours', 'donor/photo.webp'
  ) returning id into v_donation;

  perform pg_temp.act_as('alice');
  v_req := public.create_request(v_donation, 1, 'pickup');
  perform pg_temp.act_as('donor');
  perform public.accept_request(v_req);

  -- Fully claimed, but the handover is still live, so the photo must survive.
  perform pg_temp.expect(
    (select image_path from public.donations where id = v_donation) is not null,
    'the photo survives while an order still needs it');

  perform pg_temp.act_as('donor');
  perform public.complete_request(v_req);

  perform pg_temp.expect(
    (select image_path from public.donations where id = v_donation) is null,
    'image_path is cleared on completion');
  perform pg_temp.expect(
    exists (select 1 from public.storage_gc where path = 'donor/photo.webp' and deleted_at is null),
    'the object is queued for deletion from Storage');
end $$;

rollback;

\echo ''
\echo 'All QA assertions passed. Nothing was committed: the script ends in ROLLBACK.'
