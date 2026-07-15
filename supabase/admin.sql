-- In-app moderation for admins.
--
-- Reviewing held posts and reports used to mean logging into the Supabase
-- dashboard and editing rows by hand. This gives designated admin accounts an
-- in-app queue instead, using the same trust pattern as everything else here:
-- the client asks, a SECURITY DEFINER function checks who is calling and decides.
--
-- After running this, add yourself as an admin (one-time, in the SQL Editor):
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'you@example.com';

-- Who is an admin. Row Level Security is on with NO policies and all direct
-- table access revoked: the client can never read or write this table. Only the
-- SECURITY DEFINER functions below (and the service role) can touch it.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

-- Audit trail of admin decisions, so approvals, rejections, and dismissed
-- reports are on record (including the rejection reason). Same lockdown.
create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  job_id uuid,
  job_title text not null default '',
  reason text not null default '',
  created_at timestamptz not null default now()
);
alter table public.admin_actions enable row level security;
revoke all on public.admin_actions from anon, authenticated;

-- The client calls this to decide whether to show the Admin tab. Admin identity
-- lives only in the database - never hardcoded in the shipped app bundle.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Posts held for review, oldest first so nothing rots at the back of the queue.
create or replace function public.admin_pending_jobs()
returns setof public.jobs
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  return query
    select * from public.jobs
    where moderation_status = 'pending'
    order by created_at asc;
end $$;

-- Approve a held post: it becomes visible to everyone.
create or replace function public.admin_approve_job(p_job_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_title text;
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  update public.jobs
     set moderation_status = 'approved', moderation_reason = null
   where id = p_job_id and moderation_status = 'pending'
  returning title into v_title;
  if not found then
    raise exception 'This post is not waiting for review';
  end if;
  insert into public.admin_actions (admin_id, action, job_id, job_title)
  values (auth.uid(), 'approve', p_job_id, v_title);
end $$;

-- Reject a held post: the post is removed. The reason is kept in the audit
-- trail. Only pending posts can be rejected this way - taking down an already
-- approved post stays a deliberate dashboard action, not a one-tap button.
create or replace function public.admin_reject_job(p_job_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_title text;
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  delete from public.jobs
   where id = p_job_id and moderation_status = 'pending'
  returning title into v_title;
  if not found then
    raise exception 'This post is not waiting for review';
  end if;
  insert into public.admin_actions (admin_id, action, job_id, job_title, reason)
  values (auth.uid(), 'reject', p_job_id, v_title, coalesce(trim(p_reason), ''));
end $$;

-- User reports, newest first, with enough job context to act on them.
create or replace function public.admin_reports()
returns table (id uuid, job_id uuid, job_title text, reason text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  return query
    select r.id, r.job_id, j.title, r.reason, r.created_at
    from public.reports r
    join public.jobs j on j.id = r.job_id
    order by r.created_at desc;
end $$;

-- Clear a handled report from the queue.
create or replace function public.admin_dismiss_report(p_report_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_job uuid;
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  delete from public.reports where id = p_report_id returning job_id into v_job;
  if not found then
    raise exception 'This report no longer exists';
  end if;
  insert into public.admin_actions (admin_id, action, job_id)
  values (auth.uid(), 'dismiss_report', v_job);
end $$;

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.admin_pending_jobs() from public, anon;
revoke execute on function public.admin_approve_job(uuid) from public, anon;
revoke execute on function public.admin_reject_job(uuid, text) from public, anon;
revoke execute on function public.admin_reports() from public, anon;
revoke execute on function public.admin_dismiss_report(uuid) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_pending_jobs() to authenticated;
grant execute on function public.admin_approve_job(uuid) to authenticated;
grant execute on function public.admin_reject_job(uuid, text) to authenticated;
grant execute on function public.admin_reports() to authenticated;
grant execute on function public.admin_dismiss_report(uuid) to authenticated;
