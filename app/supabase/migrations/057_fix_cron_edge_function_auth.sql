-- Migration: 057_fix_cron_edge_function_auth
-- Description: Make pg_cron → Edge Function calls carry CRON_SECRET (C-2 enabler).
--
-- Prior to this migration, public.call_edge_function posted to
-- /functions/v1/{name} with no Authorization / x-cron-secret header, so every
-- guarded cron-triggered function (occurrence-generator, reminder-materializer,
-- reminder-dispatcher, cleanup) returned 401 — the reminder pipeline was dead.
--
-- Fix:
--   1. New app_settings table holding the CRON_SECRET (RLS on, no public access).
--   2. call_edge_function reads it and sends it as BOTH
--      `Authorization: Bearer <secret>` (dispatcher's guard) and
--      `x-cron-secret: <secret>` (senders' guard).
--   3. call_edge_function EXECUTE revoked from public/anon/authenticated —
--      pg_cron jobs run as postgres, so that is the only role that needs it.
--
-- OPERATOR STEP (after deploying this migration):
--   insert into public.app_settings (key, value) values ('cron_secret', '<CRON_SECRET>')
--   on conflict (key) do update set value = excluded.value;
-- where <CRON_SECRET> matches the CRON_SECRET env var set on the Edge Functions.

-- 1. Settings table (no public policies → only owner/service-role can touch it)
create table if not exists public.app_settings (
  key   text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

-- 2. Rewrite the cron caller to authenticate
create or replace function public.call_edge_function(function_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  v_url := current_setting('app.settings.project_url', true);
  if v_url is null or v_url = '' then
    v_url := 'https://dyhajmtfkjtwkijhptjx.supabase.co';
  end if;

  select value into v_secret from public.app_settings where key = 'cron_secret';
  if v_secret is null or v_secret = '' then
    raise notice 'app_settings.cron_secret is not set; cron call to % will be unauthorized', function_name;
  end if;

  perform net.http_post(
    url     := v_url || '/functions/v1/' || function_name,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || coalesce(v_secret, ''),
      'x-cron-secret', coalesce(v_secret, '')
    ),
    body    := '{}'::jsonb
  );
end;
$$;

-- 3. Only postgres (pg_cron owner) and service_role may trigger edge functions
revoke execute on function public.call_edge_function(text) from public, anon, authenticated;
grant execute on function public.call_edge_function(text) to postgres, service_role;
