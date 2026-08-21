-- Classroom rooms. Supabase does auth and rooms only: no scheduling, no
-- class history. One row per VideoSDK room, owned by the teacher who made it.
--
-- This table is the sole input to role derivation. api/session.ts reads it
-- under the service role, compares owner_id to the verified Supabase user,
-- and mints allow_mod or ask_join from the answer. Nothing else decides who
-- can moderate a class.

create type public.class_mode as enum ('class', 'lecture');

create table public.rooms (
  id         uuid primary key default gen_random_uuid(),
  room_id    text not null unique,
  owner_id   uuid not null references auth.users (id) on delete cascade,
  title      text not null check (char_length(btrim(title)) between 1 and 120),
  mode       public.class_mode not null,
  created_at timestamptz not null default now(),
  ended_at   timestamptz
);

comment on table public.rooms is
  'One VideoSDK room per row. owner_id is the only input to role derivation.';
comment on column public.rooms.room_id is
  'The VideoSDK room id. Their REST API returns it as `roomId`, not `meetingId`.';
comment on column public.rooms.mode is
  'Fixed at creation. There is no mid-class switch, so nothing announces a change.';

-- Serves the owner list on Home, the RLS predicate, and covers the foreign
-- key so the unindexed-FK advisor stays quiet. room_id already has the
-- implicit unique index that api/session.ts looks up on.
create index rooms_owner_created_idx on public.rooms (owner_id, created_at desc);

alter table public.rooms enable row level security;

-- auth.uid() wrapped in a subquery is not style: bare, it is re-evaluated per
-- row; wrapped, the planner hoists it to an InitPlan and uses the index.
create policy rooms_select_own on public.rooms
  for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy rooms_update_own on public.rooms
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy rooms_delete_own on public.rooms
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- No insert policy, deliberately. A row may only exist alongside a real
-- VideoSDK room, and creating one needs the signing secret, so inserts happen
-- server-side under the service role or not at all. Revoking the grant as
-- well means an insert policy added later by accident still cannot let a
-- browser claim a roomId it does not own.
revoke insert on public.rooms from anon, authenticated;
