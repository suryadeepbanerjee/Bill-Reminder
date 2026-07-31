-- Migration: 022_setup_cron_jobs
-- Description: Enable pg_cron + pg_net extensions and schedule all background jobs
--   for the bill reminder pipeline: occurrence generation, reminder materialization,
--   reminder dispatch, and cleanup.
--
-- IMPORTANT: After applying this migration, run the following SQL to configure
-- your Supabase project URL for the cron jobs:
--
--   SELECT set_config('app.settings.project_url', 'https://YOUR-PROJECT.supabase.co', false);
--
-- You can find your project URL at:
--   https://supabase.com/dashboard → Project → Settings → API → Project URL

-- 1. Enable extensions
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- 2. Helper function to call an Edge Function via pg_net
--    Uses a temporary table to store config (avoids ALTER DATABASE requirement)
create or replace function public.call_edge_function(function_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
begin
  -- Get project URL from session config, or fall back to hardcoded value
  v_url := current_setting('app.settings.project_url', true);

  if v_url is null or v_url = '' then
    -- Hardcoded fallback — replace with your actual project URL
    v_url := 'https://dyhajmtfkjtwkijhptjx.supabase.co';
  end if;

  perform net.http_post(
    url     := v_url || '/functions/v1/' || function_name,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
end;
$$;

-- 3. Daily occurrence generation (2:00 AM UTC)
select cron.schedule(
  'occurrence-generator',
  '0 2 * * *',
  $$select public.call_edge_function('occurrence-generator')$$
);

-- 4. Reminder materialization (every 15 minutes)
select cron.schedule(
  'reminder-materializer',
  '*/15 * * * *',
  $$select public.call_edge_function('reminder-materializer')$$
);

-- 5. Reminder dispatch (every 5 minutes)
select cron.schedule(
  'reminder-dispatcher',
  '*/5 * * * *',
  $$select public.call_edge_function('reminder-dispatcher')$$
);

-- 6. Weekly cleanup (Sunday 3:00 AM UTC)
select cron.schedule(
  'cleanup',
  '0 3 * * 0',
  $$select public.call_edge_function('cleanup')$$
);
