-- Releasing an accepted job back to the open feed.
--
-- The problem this fixes: accept_job / start_job / complete_job only ever moved a
-- job forwards. Nothing moved it back, and a job can only be deleted while it is
-- OPEN. So if a worker accepted a job and then vanished - the single most common
-- failure in this market - the job was welded to that worker permanently. The
-- customer could not re-open it, could not delete it, and no other worker could
-- take it. Their only escape was to post the job again from scratch.
--
-- Either participant may now release the job. The customer uses this when the
-- worker goes quiet; the worker uses it when they can no longer do the job.

create or replace function public.cancel_job(p_job_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_ok boolean;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  update public.jobs
     set status = 'OPEN',
         accepted_by = null,
         worker_name = '',
         accepted_at = null
   where id = p_job_id
     and status in ('ACCEPTED', 'IN_PROGRESS')
     and (created_by = auth.uid() or accepted_by = auth.uid())
  returning true into v_ok;

  if not found then
    raise exception 'This job cannot be cancelled';
  end if;

  -- The chat belonged to a match that no longer exists. Messages are readable by
  -- whoever is currently accepted_by, so leaving them behind would let the NEXT
  -- worker who accepts read the previous worker's private conversation with the
  -- customer. Clear the thread with the match.
  delete from public.messages where job_id = p_job_id;
  delete from public.chat_reads where job_id = p_job_id;
end $$;

revoke execute on function public.cancel_job(uuid) from public, anon;
grant execute on function public.cancel_job(uuid) to authenticated;
