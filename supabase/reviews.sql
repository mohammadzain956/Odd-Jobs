-- Ratings and reviews: the trust layer.
--
-- Two strangers meet to exchange labour and cash. Without a track record, a
-- customer has no signal about who is about to show up at their house, and a
-- good worker earns nothing that carries to the next job. Reviews fix both.
--
-- Rules enforced in the database, not the app:
--   - You may only review a job you took part in, and only once it is COMPLETED.
--   - You may only review the OTHER participant. The client never sends who is
--     being rated; the server derives it from the job. So a review cannot be
--     forged against someone you never worked with.
--   - One review per person per job.

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  rater_id uuid not null references auth.users (id) on delete cascade,
  ratee_id uuid not null references auth.users (id) on delete cascade,
  rater_name text not null default '',
  rating int not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  unique (job_id, rater_id)
);

alter table public.reviews enable row level security;

-- Reviews are public on purpose: a rating nobody can see is not a trust signal.
create policy "reviews are readable by everyone"
  on public.reviews for select
  using (true);

-- No insert/update/delete policy. Reviews are written only through submit_review
-- below, so the eligibility rules cannot be bypassed, and nobody can edit or
-- delete a review they have received.

create or replace function public.submit_review(p_job_id uuid, p_rating int, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_job public.jobs%rowtype;
  v_ratee uuid;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5';
  end if;

  select * into v_job from public.jobs where id = p_job_id;
  if not found or v_job.status <> 'COMPLETED' then
    raise exception 'You can only review a completed job';
  end if;

  -- Derive who is being rated: the participant who is not the caller.
  if v_job.created_by = auth.uid() then
    v_ratee := v_job.accepted_by;
  elsif v_job.accepted_by = auth.uid() then
    v_ratee := v_job.created_by;
  else
    raise exception 'You did not take part in this job';
  end if;

  if v_ratee is null then
    raise exception 'This job has no other participant to review';
  end if;

  select coalesce(nullif(trim(raw_user_meta_data->>'display_name'), ''), 'User')
    into v_name from auth.users where id = auth.uid();

  insert into public.reviews (job_id, rater_id, ratee_id, rater_name, rating, comment)
  values (p_job_id, auth.uid(), v_ratee, v_name, p_rating, coalesce(trim(p_comment), ''))
  on conflict (job_id, rater_id) do nothing;
end $$;

-- Public reputation summary for one user: what a stranger is allowed to know.
-- Deliberately aggregate-only - it exposes no email, no contact details, and no
-- job history beyond the counts.
create or replace function public.profile_stats(p_user_id uuid)
returns table (
  name text,
  jobs_completed bigint,
  jobs_posted bigint,
  review_count bigint,
  avg_rating numeric,
  member_since timestamptz
)
language sql security definer set search_path = public as $$
  select
    coalesce(nullif(trim(u.raw_user_meta_data->>'display_name'), ''), 'User') as name,
    (select count(*) from public.jobs j
      where j.accepted_by = p_user_id and j.status = 'COMPLETED') as jobs_completed,
    (select count(*) from public.jobs j where j.created_by = p_user_id) as jobs_posted,
    (select count(*) from public.reviews r where r.ratee_id = p_user_id) as review_count,
    (select round(avg(r.rating), 1) from public.reviews r where r.ratee_id = p_user_id) as avg_rating,
    u.created_at as member_since
  from auth.users u
  where u.id = p_user_id;
$$;

revoke execute on function public.submit_review(uuid, int, text) from public, anon;
revoke execute on function public.profile_stats(uuid) from public, anon;
grant execute on function public.submit_review(uuid, int, text) to authenticated;
grant execute on function public.profile_stats(uuid) to authenticated;

create index if not exists reviews_ratee_idx on public.reviews (ratee_id, created_at desc);
create index if not exists reviews_rater_idx on public.reviews (rater_id);
