-- Migration: 071_user_exists_rpc
-- Description: Email-existence precheck for the forgot-password flow.
--
-- The forgot-password screens (app + web) now tell the user when the
-- submitted email has no account before sending a reset code. This is an
-- account-enumeration surface by design (the product owner explicitly
-- requested the feedback); it is limited to a cheap boolean SELECT and the
-- surrounding flows remain captcha-gated + rate-limited.
--
-- SECURITY DEFINER so anonymous users on the auth pages can run it without
-- profiles RLS interfering (the caller never sees the row, just a boolean).

create or replace function public.user_exists(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where lower(email) = lower(p_email)
  );
$$;

revoke execute on function public.user_exists(text) from public;
grant execute on function public.user_exists(text) to anon, authenticated;