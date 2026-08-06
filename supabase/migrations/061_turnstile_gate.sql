-- 061_turnstile_gate.sql
-- Abuse-protection gate for Cloudflare Turnstile + rate limiting.
--
-- The turnstile-guard Edge Function enforces policy and calls rate_gate_check
-- with the service role. The RPC is NOT callable by anon/authenticated users:
-- execute is revoked from PUBLIC and granted only to service_role, so clients
-- can never read the log, burn buckets of other actors, or bypass limits.

create table if not exists public.gate_limit (
  action       text    not null,
  actor        text    not null,
  window_start bigint  not null, -- floor(unix_seconds / window) * window
  count        integer not null default 1,
  primary key (action, actor, window_start)
);

alter table public.gate_limit enable row level security;

-- Windowed counter with atomic upsert (row-lock serializes concurrent hits).
-- Returns allowed=false + retry_after_seconds when the bucket is full.
create or replace function public.rate_gate_check(
  p_action         text,
  p_actor          text,
  p_limit          integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now    bigint;
  v_window bigint;
  v_count  integer;
begin
  v_now    := extract(epoch from now())::bigint;
  v_window := (v_now / p_window_seconds) * p_window_seconds;

  insert into public.gate_limit (action, actor, window_start, count)
  values (p_action, p_actor, v_window, 1)
  on conflict (action, actor, window_start)
  do update set count = public.gate_limit.count + 1
  returning count into v_count;

  -- Opportunistic cleanup — purge windows older than 72 hours (prime-modulo
  -- sampling keeps this rare so it never contends with live traffic).
  if (v_count % 257) = 0 then
    delete from public.gate_limit
    where window_start < v_now - 259200;
  end if;

  allowed := v_count <= p_limit;
  retry_after_seconds := case
    when allowed then 0
    else greatest(1, (v_window + p_window_seconds) - v_now)
  end;
  return next;
end;
$$;

revoke all on function public.rate_gate_check(text, text, integer, integer) from public;
revoke all on function public.rate_gate_check(text, text, integer, integer) from anon;
revoke all on function public.rate_gate_check(text, text, integer, integer) from authenticated;
grant execute on function public.rate_gate_check(text, text, integer, integer) to service_role;
