-- Odd Jobs database schema.
-- Run this once in the Supabase SQL Editor (Dashboard > SQL Editor > New query).

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  details text not null,
  location text not null,
  pay numeric not null,
  category text not null,
  urgency text not null,
  status text not null default 'OPEN',
  moderation_status text not null default 'pending',
  moderation_reason text,
  requester_name text not null default 'Customer',
  worker_name text not null default '',
  featured boolean not null default false,
  photos text[] not null default '{}',
  distance text not null default 'Nearby',
  created_by uuid references auth.users (id),
  accepted_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  completed_at timestamptz
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  reason text not null default '',
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

alter table public.jobs enable row level security;
alter table public.reports enable row level security;

-- Everyone can read approved jobs; posters can also see their own pending posts.
create policy "read approved or own jobs"
  on public.jobs for select
  using (moderation_status = 'approved' or created_by = auth.uid());

-- No insert policy on jobs: posts are created only through the create-job
-- edge function (service role), which runs AI moderation first.

-- Signed-in users can update approved jobs (accept / start / complete),
-- and posters can always update their own posts (edit while pending).
create policy "update approved or own jobs"
  on public.jobs for update
  using (auth.role() = 'authenticated' and (moderation_status = 'approved' or created_by = auth.uid()));

-- Posters can delete their own posts.
create policy "delete own jobs"
  on public.jobs for delete
  using (created_by = auth.uid());

create policy "insert own reports"
  on public.reports for insert
  with check (created_by = auth.uid());

-- Storage bucket for job photos: signed-in users upload, everyone can view.
insert into storage.buckets (id, name, public) values ('job-photos', 'job-photos', true);

create policy "upload job photos"
  on storage.objects for insert
  with check (bucket_id = 'job-photos' and auth.role() = 'authenticated');

create policy "read job photos"
  on storage.objects for select
  using (bucket_id = 'job-photos');

-- Sample jobs so the marketplace is not empty on first launch.
insert into public.jobs (title, details, location, pay, category, urgency, moderation_status, requester_name, featured, distance) values
  ('Move sofa to second floor', 'Need two careful helpers to move one sofa and a small table from the garage to an upstairs room.', 'DHA Phase 5, Lahore', 4500, 'Moving', 'Today', 'approved', 'Verified customer', true, '2.1 km'),
  ('Assemble wardrobe', 'Flat-pack wardrobe is delivered. Bring a basic drill and help assemble it neatly.', 'Gulberg, Lahore', 3200, 'Assembly', 'This week', 'approved', 'Verified customer', false, '3.4 km'),
  ('Deep clean small office', 'One-room office needs floor cleaning, dusting, and trash removal before Monday.', 'Blue Area, Islamabad', 6000, 'Cleaning', 'Flexible', 'approved', 'Verified customer', true, 'Nearby'),
  ('Deliver documents', 'Pick up a sealed envelope and deliver it across town. Delivery window is 2 pm to 5 pm.', 'Clifton, Karachi', 1800, 'Delivery', 'Today', 'approved', 'Verified customer', false, '1.6 km');
