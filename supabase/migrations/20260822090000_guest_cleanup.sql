-- Guest accounts expire. Nothing else in Supabase does this for us.
--
-- signInAnonymously() writes a real auth.users row, and a guest who closes
-- the tab never comes back to it - the session only ever lived in that
-- browser's localStorage. Left alone the table grows for as long as the demo
-- is up, which is the one real cost of guest sign-in.
--
-- rooms.owner_id is `on delete cascade`, so removing an expired guest removes
-- the classes they started with them. That is the intended reading: a class
-- whose owner can never sign in again cannot be moderated, joined as teacher,
-- or ended, so it is not a class any more.
--
-- Thirty days is long enough that nobody loses a class they are still using
-- (meeting tokens live 600 seconds; nothing here outlives a session by more
-- than the link someone bookmarked) and short enough that abuse does not
-- accumulate.
--
-- Permanent accounts are never touched: `is_anonymous is true` is the whole
-- predicate, and it is a column on auth.users, not a claim we derive.

create extension if not exists pg_cron;

create or replace function public.delete_expired_guests()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users
  where is_anonymous is true
    and created_at < now() - interval '30 days';
$$;

comment on function public.delete_expired_guests is
  'Removes guest accounts older than 30 days. Cascades to public.rooms.';

-- Not executable by a browser under any role. The function exists to give
-- cron one name to call, not to give the client a new capability.
revoke execute on function public.delete_expired_guests() from anon, authenticated;

select cron.schedule(
  'delete-expired-guests',
  '17 3 * * *',
  $$select public.delete_expired_guests()$$
);
