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
