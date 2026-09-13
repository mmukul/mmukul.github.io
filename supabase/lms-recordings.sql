-- NextGen DevSecOps AI — LMS Recordings Extension
-- Run this AFTER the existing supabase/schema.sql and admin security policies.

create table if not exists public.recordings (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  recording_url text not null,
  passcode text,
  session_date date,
  duration_minutes integer,
  created_at timestamptz not null default now()
);

alter table public.recordings enable row level security;

drop policy if exists "students read enrolled recordings" on public.recordings;
create policy "students read enrolled recordings" on public.recordings
for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'student'
      and p.status = 'active'
  )
  and exists (
    select 1 from public.enrollments e
    where e.student_id = auth.uid()
      and e.course_id = recordings.course_id
      and e.status in ('active','completed')
  )
);

drop policy if exists "admins manage recordings" on public.recordings;
create policy "admins manage recordings" on public.recordings
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Example (replace course UUID and Zoom URL):
-- insert into public.recordings (course_id,title,description,recording_url,passcode,session_date,duration_minutes)
-- values ('COURSE-UUID','DevSecOps Session 01','Introduction to DevSecOps','https://zoom.us/rec/share/...','123456','2026-09-13',120);
