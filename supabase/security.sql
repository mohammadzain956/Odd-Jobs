-- Security hardening. Already applied to the live project; kept here for fresh setups.
--
-- The problem this fixes: a blanket "authenticated users may update approved
-- jobs" policy let any signed-in user rewrite any job row - including setting
-- themselves as accepted_by (which unlocks that job's private chat), flipping
-- their own held post to approved (bypassing moderation), or editing someone
-- else's post. Direct UPDATE is now revoked entirely; every state change goes
-- through a function that checks who the caller is and what transition is legal.

drop policy if exists "update approved or own jobs" on public.jobs;
revoke update on public.jobs from authenticated, anon;

-- Accept an open job. Cannot accept your own post, cannot steal an accepted one.
create or replace function public.accept_job(p_job_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select coalesce(nullif(trim(raw_user_meta_data->>'display_name'), ''), 'Worker')
    into v_name from auth.users where id = auth.uid();

  update public.jobs
     set status = 'ACCEPTED', accepted_by = auth.uid(), worker_name = v_name, accepted_at = now()
   where id = p_job_id
     and status = 'OPEN'
     and moderation_status = 'approved'
     and created_by <> auth.uid();

  if not found then
    raise exception 'This job cannot be accepted';
  end if;
end $$;

-- Only the assigned worker can start the work.
create or replace function public.start_job(p_job_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.jobs set status = 'IN_PROGRESS'
   where id = p_job_id and status = 'ACCEPTED' and accepted_by = auth.uid();
  if not found then
    raise exception 'This job cannot be started';
  end if;
end $$;

-- Either participant can mark work complete.
create or replace function public.complete_job(p_job_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.jobs set status = 'COMPLETED', completed_at = now()
   where id = p_job_id
     and status = 'IN_PROGRESS'
     and (accepted_by = auth.uid() or created_by = auth.uid());
  if not found then
    raise exception 'This job cannot be completed';
  end if;
end $$;

revoke execute on function public.accept_job(uuid) from public, anon;
revoke execute on function public.start_job(uuid) from public, anon;
revoke execute on function public.complete_job(uuid) from public, anon;
grant execute on function public.accept_job(uuid) to authenticated;
grant execute on function public.start_job(uuid) to authenticated;
grant execute on function public.complete_job(uuid) to authenticated;

-- Posts can only be deleted by their author, and only before work starts.
drop policy if exists "delete own jobs" on public.jobs;
create policy "delete own open jobs"
  on public.jobs for delete
  using (created_by = auth.uid() and status = 'OPEN');

-- Abuse limits.
alter table public.messages
  add constraint messages_body_length check (char_length(body) between 1 and 2000);

create unique index if not exists reports_one_per_user
  on public.reports (job_id, created_by);

-- Photos: 5 MB cap, images only, and each user can only write inside their own
-- folder (so nobody can overwrite or squat on another user's photo paths).
update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'job-photos';

drop policy if exists "upload job photos" on storage.objects;
create policy "upload own job photos"
  on storage.objects for insert
  with check (
    bucket_id = 'job-photos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Indexes for the queries the app actually runs.
create index if not exists jobs_feed_idx on public.jobs (moderation_status, created_at desc);
create index if not exists jobs_city_idx on public.jobs (city);
create index if not exists jobs_created_by_idx on public.jobs (created_by);
create index if not exists jobs_accepted_by_idx on public.jobs (accepted_by);
create index if not exists messages_job_idx on public.messages (job_id, created_at);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);
create index if not exists chat_reads_user_idx on public.chat_reads (user_id);
