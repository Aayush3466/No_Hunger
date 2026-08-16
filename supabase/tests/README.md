# QA

Two things to run before you trust a change to `supabase/functions.sql`.

Both need a **scratch database**, never production. On Supabase, make a second
free project, or use the local CLI (`supabase start`).

---

## 1. The assertion suite

```bash
psql -v ON_ERROR_STOP=1 -d <scratch-db> -f supabase/tests/qa.sql
```

34 assertions, ending in `ROLLBACK` so nothing is left behind. A clean run
prints `All QA assertions passed.` and every check as `ok: …`. Any failure
raises and stops.

It covers:

- accepting 3 of 4 servings leaves 1 and the listing stays `partially_claimed`
- a second accept that would oversell fails with `NOT_ENOUGH_SERVINGS` and moves nothing
- cancelling restores exactly what it took, and a second cancel restores nothing extra
- the last serving takes the listing to `completed` and off the read path
- `get_available_donations()` never returns expired or fully-claimed food
- `expire_donations()` marks the listing and closes out pending requests
- `timeout_stale_orders()` restores servings with no overshoot and puts the food back
- a matched receiver sees the donor's phone while accepted, a stranger never does,
  and access is revoked the instant the order completes
- the wrong party cannot confirm handover, and a double confirm is harmless
- self-request, duplicate active request and blocking are all refused server-side
- a photo survives while an order still needs it, then gets queued for deletion

---

## 2. The concurrency case, with two real sessions

The assertion suite runs sequentially, which proves the re-check but not the
lock. This proves the lock.

Set up a listing with 3 servings and two requests for 2 each:

```sql
-- as the donor
insert into public.donations (id, donor_id, food_name, category, food_type,
  total_servings, servings_remaining, pickup_lat, pickup_lng, fulfilment_mode, expires_at)
values ('99999999-9999-9999-9999-999999999999', '<donor-uuid>',
  'Race Curry', 'veg', 'cooked', 3, 3, 27.7, 85.3, 'pickup', now() + interval '5 hours');
-- then create_request(...) twice, for 2 servings each, as two different receivers
```

**Session A** (hold the transaction open so B has to wait):

```sql
begin;
select public.accept_request('<request-a>');
select pg_sleep(3);
commit;
```

**Session B**, started about a second later:

```sql
select public.accept_request('<request-b>');
```

Expected, and what this build does:

```
A: {"servings_remaining": 1, "donation_status": "partially_claimed", ...}
B: ERROR:  NOT_ENOUGH_SERVINGS
   CONTEXT:  PL/pgSQL function accept_request(uuid) line 34 at RAISE
```

Session B blocks on `SELECT … FOR UPDATE` for the full three seconds, then fails
its re-check and rolls back whole. Final state: `servings_remaining = 1`, one
request `accepted`, one still `pending`. Nothing was oversold and nothing was
half-applied.

If B ever succeeds, or the two accepts interleave, the serialization point in
`accept_request()` has been broken. That is the regression this file exists to
catch.

---

## Running against plain PostgreSQL

`qa.sql` needs `auth.users`, `auth.uid()` and `storage.objects`, which Supabase
provides. To run it on a bare PostgreSQL instance, create stand-ins first:

```sql
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create schema storage;
create schema extensions;
create extension pgcrypto with schema extensions;

create table auth.users (
  id uuid primary key default extensions.gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);

create function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table storage.buckets (
  id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default extensions.gen_random_uuid(),
  bucket_id text, name text, owner uuid
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[]
  language sql immutable as $$ select string_to_array(name, '/') $$;

create publication supabase_realtime;
```

`cron.sql` still needs `pg_cron`, which Supabase has and a bare instance
usually does not. Skip that one file locally; the scheduled functions
themselves (`expire_donations`, `timeout_stale_orders`) are plain SQL and are
already exercised by `qa.sql`.

---

## Still to come in Step F

- RLS matrix per role, asserted from `anon` / `authenticated` / a second user's
  session rather than from a superuser connection
- a Playwright pass over the two flows that touch the browser: photo compression
  producing a ~50 KB WebP with no EXIF, and the map dropping a marker the moment
  a countdown reaches zero
