-- Chat between the job poster and the worker who accepted the job.
-- Already applied to the live project; kept here for fresh setups.

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  sender_id uuid not null references auth.users (id),
  sender_name text not null default '',
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

-- Only the two participants of a job (poster and accepted worker) can read its chat.
create policy "read messages as participant"
  on public.messages for select
  using (
    exists (
      select 1 from public.jobs j
      where j.id = job_id and (j.created_by = auth.uid() or j.accepted_by = auth.uid())
    )
  );

-- Participants can send messages as themselves.
create policy "send messages as participant"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.jobs j
      where j.id = job_id and (j.created_by = auth.uid() or j.accepted_by = auth.uid())
    )
  );

-- Stream new messages to the app in real time.
alter publication supabase_realtime add table public.messages;

-- Tracks how far each user has read in each chat, for unread badges.
create table public.chat_reads (
  job_id uuid not null references public.jobs (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  last_read_at timestamptz not null default now(),
  primary key (job_id, user_id)
);

alter table public.chat_reads enable row level security;

create policy "read own chat reads"
  on public.chat_reads for select
  using (user_id = auth.uid());

create policy "insert own chat reads"
  on public.chat_reads for insert
  with check (user_id = auth.uid());

create policy "update own chat reads"
  on public.chat_reads for update
  using (user_id = auth.uid());

-- Expo push notification tokens, one row per device.
create table public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

alter table public.push_tokens enable row level security;

create policy "manage own push tokens"
  on public.push_tokens for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Unread message count per job for the signed-in user.
create or replace function public.unread_counts()
returns table (job_id uuid, unread bigint)
language sql security invoker as $$
  select m.job_id, count(*) as unread
  from public.messages m
  join public.jobs j on j.id = m.job_id
  left join public.chat_reads r on r.job_id = m.job_id and r.user_id = auth.uid()
  where (j.created_by = auth.uid() or j.accepted_by = auth.uid())
    and m.sender_id <> auth.uid()
    and m.created_at > coalesce(r.last_read_at, 'epoch')
  group by m.job_id;
$$;
