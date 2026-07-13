-- Saved jobs ("favorites"). Run this in the Supabase SQL Editor.
-- A favorite is private: you can only see, add, and remove your own.

create table if not exists public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

alter table public.favorites enable row level security;

-- Own-rows-only, in all three directions. There is no policy that lets one user
-- read another user's saves, so the list stays private.
drop policy if exists "favorites are readable by their owner" on public.favorites;
create policy "favorites are readable by their owner"
  on public.favorites for select
  using (auth.uid() = user_id);

drop policy if exists "users can save a job for themselves" on public.favorites;
create policy "users can save a job for themselves"
  on public.favorites for insert
  with check (auth.uid() = user_id);

drop policy if exists "users can remove their own save" on public.favorites;
create policy "users can remove their own save"
  on public.favorites for delete
  using (auth.uid() = user_id);

-- Fetching one user's saved list is the only read pattern.
create index if not exists favorites_user_idx on public.favorites (user_id);
