-- Migration: 017_delete_account_rpc
-- Description: RPC to safely delete the authenticated user's account from auth.users

create or replace function public.delete_user_account()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Delete from auth.users (cascades to profiles, households, etc.)
  delete from auth.users where id = auth.uid();
end;
$$;
