-- =============================================================================
-- NoHunger — 05_cron.sql
-- Scheduled correctness. Run LAST.
--
-- Expiry lives here, not on Vercel Cron: the Hobby tier only runs a job once a
-- day, and food expires in hours. pg_cron is on the Supabase free tier and runs
-- inside the same database as the data it is correcting.
-- =============================================================================

create extension if not exists pg_cron with schema extensions;

-- Re-running this file should not create duplicate jobs.
select cron.unschedule(jobid) from cron.job
where jobname in (
  'nohunger-expire-donations',
  'nohunger-timeout-orders',
  'nohunger-purge-live-locations',
  'nohunger-sweep-orphan-images'
);

-- Every minute: flip open listings past expires_at. The expires_at > now()
-- filter inside get_available_donations() is the second safety net between ticks.
select cron.schedule(
  'nohunger-expire-donations',
  '* * * * *',
  $$ select public.expire_donations(); $$
);

-- Every 5 minutes: auto-cancel accepted orders nobody completed, restoring
-- servings and putting the food back on the map if it is still valid.
select cron.schedule(
  'nohunger-timeout-orders',
  '*/5 * * * *',
  $$ select public.timeout_stale_orders(); $$
);

-- Every 5 minutes: drop location rows for orders that are no longer active.
select cron.schedule(
  'nohunger-purge-live-locations',
  '*/5 * * * *',
  $$ select public.purge_stale_live_locations(); $$
);

-- Every 15 minutes: queue any photo that belongs to a finished listing.
-- Draining the queue into Storage is done by /api/gc/images.
select cron.schedule(
  'nohunger-sweep-orphan-images',
  '*/15 * * * *',
  $$ select public.sweep_orphan_images(); $$
);

-- -----------------------------------------------------------------------------
-- Realtime replication. Without this the map never receives change events.
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table public.donations;
alter publication supabase_realtime add table public.requests;
alter publication supabase_realtime add table public.live_locations;
alter publication supabase_realtime add table public.notifications;

-- Realtime needs the full old row to evaluate RLS on UPDATE/DELETE events.
alter table public.donations      replica identity full;
alter table public.requests       replica identity full;
alter table public.live_locations replica identity full;
alter table public.notifications  replica identity full;

-- Check what is scheduled:
--   select jobname, schedule, active from cron.job order by jobname;
-- Check recent runs:
--   select jobname, status, return_message, start_time
--   from cron.job_run_details order by start_time desc limit 20;
