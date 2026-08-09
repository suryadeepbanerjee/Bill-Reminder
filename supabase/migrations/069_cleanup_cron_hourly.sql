-- Migration: 062_cleanup_cron_hourly
-- Description: Run the cleanup Edge Function every hour instead of weekly.
--
-- The weekly (Sunday 03:00 UTC) cadence predates invite expiry. The cleanup
-- function now sweeps pending invitations older than 1 hour into status
-- 'removed' (so expired invites stop showing as "Pending" in the members
-- list and re-invites behave cleanly). An hourly cadence keeps that sweep
-- fresh. cron.schedule upserts by jobname, so re-running is safe.

select cron.schedule(
  'cleanup',
  '0 * * * *',
  $$select public.call_edge_function('cleanup')$$
);