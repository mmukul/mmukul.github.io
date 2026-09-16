-- ============================================================
-- NextGen DevSecOps AI — Production LMS Supabase Schema
-- ============================================================
-- Single source of truth for:
--   • Student LMS
--   • Admin Portal
--   • Course / Batch / Enrollment management
--   • Progress / Assignments / Submissions / Certificates
--   • Zoom Cloud Recordings
--   • Active-student access control
--   • Least-privilege Row Level Security (RLS)
--
-- Safe to run on a fresh Supabase project.
-- For an existing project, review the migration notes at the end.
-- Never put a Supabase service_role/secret key in the website.
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- 1. Core tables
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  student_id text unique,
  full_name text not null,
  phone text,
  role text not null default 'student',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('student','admin')),
  constraint profiles_status_check check (status in ('active','inactive'))
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  course_id uuid references public.courses(id) on delete set null,
  start_date date,
  end_date date,
  status text not null default 'planned'
    check (status in ('planned','active','completed')),
  created_at timestamptz not null default now()
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete set null,
  status text not null default 'active'
    check (status in ('active','completed','cancelled')),
  enrolled_at timestamptz not null default now(),
  unique(student_id, course_id, batch_id)
);

create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  sort_order int not null default 0
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  title text not null,
  content_path text,
  sort_order int not null default 0
);

create table if not exists public.progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  unique(student_id, lesson_id)
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  material_path text
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  submission_path text,
  notes text,
  status text not null default 'submitted'
    check (status in ('submitted','reviewed','returned')),
  feedback text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  certificate_number text unique,
  file_path text,
  issued_at timestamptz
);

-- Zoom Cloud Recording metadata. The actual video remains hosted by Zoom.
create table if not exists public.recordings (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  recording_date date,
  duration_minutes int,
  zoom_url text not null,
  zoom_passcode text,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 2. Existing-schema compatibility / normalization
-- ============================================================

-- Older versions used status = completed on profiles.
-- Normalize it to inactive before enforcing the production constraint.
update public.profiles
set status = 'inactive'
where status = 'completed';

-- If the original table already exists without role, add it safely.
alter table public.profiles
  add column if not exists role text not null default 'student';

-- Older schemas may still have the old constraints. Remove them by name
-- before applying the production constraints below.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles drop constraint if exists profiles_status_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('student','admin'));

alter table public.profiles
  add constraint profiles_status_check
  check (status in ('active','inactive'));

-- ============================================================
-- 3. Indexes
-- ============================================================

create index if not exists idx_enrollments_student on public.enrollments(student_id);
create index if not exists idx_enrollments_course on public.enrollments(course_id);
create index if not exists idx_modules_course on public.modules(course_id);
create index if not exists idx_lessons_module on public.lessons(module_id);
create index if not exists idx_progress_student on public.progress(student_id);
create index if not exists idx_assignments_course on public.assignments(course_id);
create index if not exists idx_submissions_student on public.submissions(student_id);
create index if not exists idx_submissions_assignment on public.submissions(assignment_id);
create index if not exists idx_certificates_student on public.certificates(student_id);
create index if not exists idx_recordings_course on public.recordings(course_id);
create index if not exists idx_recordings_published on public.recordings(published);

-- ============================================================
-- 4. Helper functions
-- ============================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.status = 'active'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.is_active_student()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'student'
      and p.status = 'active'
  );
$$;

revoke all on function public.is_active_student() from public;
grant execute on function public.is_active_student() to authenticated;

-- Used by RLS to determine whether the current student is enrolled in a course.
create or replace function public.is_enrolled_in_course(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.enrollments e on e.student_id = p.id
    where p.id = auth.uid()
      and p.role = 'student'
      and p.status = 'active'
      and e.course_id = target_course_id
      and e.status in ('active','completed')
  );
$$;

revoke all on function public.is_enrolled_in_course(uuid) from public;
grant execute on function public.is_enrolled_in_course(uuid) to authenticated;

-- Automatically create a normal student profile for a new Auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'student',
    'active'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- ============================================================
-- 5. Seed current courses
-- ============================================================

insert into public.courses (name, slug, description) values
  ('DevOps','devops','Practical DevOps training'),
  ('DevSecOps & AppSec','devsecops-appsec','Foundational, Intermediate and Advanced DevSecOps & AppSec training'),
  ('GenAI & AI Security','genai-ai-security','Practical Generative AI and AI Security training')
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description;

-- ============================================================
-- 6. Enable RLS
-- ============================================================

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.batches enable row level security;
alter table public.enrollments enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.progress enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.certificates enable row level security;
alter table public.recordings enable row level security;

-- ============================================================
-- 7. Rebuild RLS policies cleanly
-- ============================================================
-- Dropping these policy names first makes this section re-runnable.

-- Profiles
 drop policy if exists "students read own profile" on public.profiles;
 drop policy if exists "students update own profile" on public.profiles;
 drop policy if exists "students insert own profile" on public.profiles;
 drop policy if exists "admins manage profiles" on public.profiles;
create policy "students read own profile"
on public.profiles for select to authenticated
using (id = auth.uid());

-- Students must NOT be able to change role/status themselves.
-- Profile changes are managed by the Admin Portal.
create policy "admins manage profiles"
on public.profiles for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Courses
 drop policy if exists "authenticated read courses" on public.courses;
 drop policy if exists "admins manage courses" on public.courses;
create policy "students read enrolled courses"
on public.courses for select to authenticated
using (public.is_active_student() and public.is_enrolled_in_course(id));

create policy "admins manage courses"
on public.courses for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Batches
 drop policy if exists "students read own batches" on public.batches;
 drop policy if exists "admins manage batches" on public.batches;
create policy "students read own batches"
on public.batches for select to authenticated
using (
  public.is_active_student()
  and exists (
    select 1 from public.enrollments e
    where e.student_id = auth.uid()
      and e.batch_id = public.batches.id
      and e.status in ('active','completed')
  )
);

create policy "admins manage batches"
on public.batches for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Enrollments
 drop policy if exists "students read own enrollments" on public.enrollments;
 drop policy if exists "admins manage enrollments" on public.enrollments;
create policy "students read own enrollments"
on public.enrollments for select to authenticated
using (
  student_id = auth.uid()
  and public.is_active_student()
);

create policy "admins manage enrollments"
on public.enrollments for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Modules
 drop policy if exists "students read modules" on public.modules;
 drop policy if exists "admins manage modules" on public.modules;
create policy "students read enrolled modules"
on public.modules for select to authenticated
using (public.is_enrolled_in_course(course_id));

create policy "admins manage modules"
on public.modules for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Lessons
 drop policy if exists "students read lessons" on public.lessons;
 drop policy if exists "admins manage lessons" on public.lessons;
create policy "students read enrolled lessons"
on public.lessons for select to authenticated
using (
  exists (
    select 1
    from public.modules m
    where m.id = public.lessons.module_id
      and public.is_enrolled_in_course(m.course_id)
  )
);

create policy "admins manage lessons"
on public.lessons for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Progress
 drop policy if exists "students read own progress" on public.progress;
 drop policy if exists "students write own progress" on public.progress;
 drop policy if exists "students update own progress" on public.progress;
 drop policy if exists "admins manage progress" on public.progress;
create policy "students read own progress"
on public.progress for select to authenticated
using (student_id = auth.uid() and public.is_active_student());

create policy "students write own progress"
on public.progress for insert to authenticated
with check (
  student_id = auth.uid()
  and public.is_active_student()
  and exists (
    select 1
    from public.lessons l
    join public.modules m on m.id = l.module_id
    where l.id = public.progress.lesson_id
      and public.is_enrolled_in_course(m.course_id)
  )
);

create policy "students update own progress"
on public.progress for update to authenticated
using (student_id = auth.uid() and public.is_active_student())
with check (student_id = auth.uid() and public.is_active_student());

create policy "admins manage progress"
on public.progress for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Assignments
 drop policy if exists "students read assignments" on public.assignments;
 drop policy if exists "admins manage assignments" on public.assignments;
create policy "students read enrolled assignments"
on public.assignments for select to authenticated
using (public.is_enrolled_in_course(course_id));

create policy "admins manage assignments"
on public.assignments for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Submissions
 drop policy if exists "students read own submissions" on public.submissions;
 drop policy if exists "students create own submissions" on public.submissions;
 drop policy if exists "admins manage submissions" on public.submissions;
create policy "students read own submissions"
on public.submissions for select to authenticated
using (student_id = auth.uid() and public.is_active_student());

create policy "students create own submissions"
on public.submissions for insert to authenticated
with check (
  student_id = auth.uid()
  and public.is_active_student()
  and exists (
    select 1
    from public.assignments a
    where a.id = public.submissions.assignment_id
      and public.is_enrolled_in_course(a.course_id)
  )
);

create policy "admins manage submissions"
on public.submissions for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Certificates
 drop policy if exists "students read own certificates" on public.certificates;
 drop policy if exists "admins manage certificates" on public.certificates;
create policy "students read own certificates"
on public.certificates for select to authenticated
using (
  student_id = auth.uid()
  and public.is_active_student()
  and public.is_enrolled_in_course(course_id)
);

create policy "admins manage certificates"
on public.certificates for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Zoom Recordings
 drop policy if exists "students read published recordings" on public.recordings;
 drop policy if exists "admins manage recordings" on public.recordings;
create policy "students read published recordings"
on public.recordings for select to authenticated
using (
  published = true
  and public.is_enrolled_in_course(course_id)
);

create policy "admins manage recordings"
on public.recordings for all to authenticated
using (public.is_admin())
with check (public.is_admin());



-- ============================================================
-- 7A. Secure admin RPCs for enrollment and certificate operations
-- ============================================================
-- These SECURITY DEFINER functions perform privileged admin writes server-side.
-- The browser only invokes them with the authenticated admin session.

create or replace function public.admin_assign_course(
  target_student_id uuid,
  target_course_id uuid,
  target_batch_id uuid default null,
  target_status text default 'active'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_id uuid;
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Access denied. Active administrator account required.' using errcode = '42501';
  end if;

  if target_status not in ('active','completed','cancelled') then
    raise exception 'Invalid enrollment status: %', target_status;
  end if;

  if not exists (select 1 from public.profiles where id = target_student_id and role = 'student') then
    raise exception 'Student profile not found or is not a student.';
  end if;

  if not exists (select 1 from public.courses where id = target_course_id) then
    raise exception 'Course not found.';
  end if;

  if target_batch_id is not null and not exists (select 1 from public.batches where id = target_batch_id) then
    raise exception 'Selected batch was not found.';
  end if;

  -- Match by student + course, so changing the batch does not create duplicates.
  select e.id into existing_id
  from public.enrollments e
  where e.student_id = target_student_id
    and e.course_id = target_course_id
  order by e.enrolled_at desc
  limit 1;

  if existing_id is not null then
    update public.enrollments
    set batch_id = target_batch_id,
        status = target_status
    where id = existing_id;
    result := jsonb_build_object('success', true, 'action', 'updated', 'enrollment_id', existing_id);
  else
    insert into public.enrollments(student_id, course_id, batch_id, status)
    values(target_student_id, target_course_id, target_batch_id, target_status)
    returning id into existing_id;
    result := jsonb_build_object('success', true, 'action', 'created', 'enrollment_id', existing_id);
  end if;

  return result;
end;
$$;

revoke all on function public.admin_assign_course(uuid,uuid,uuid,text) from public;
grant execute on function public.admin_assign_course(uuid,uuid,uuid,text) to authenticated;

create or replace function public.admin_issue_certificate(
  target_student_id uuid,
  target_course_id uuid,
  target_certificate_number text default null,
  target_issued_at date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cert_id uuid;
  cert_num text;
begin
  if not public.is_admin() then
    raise exception 'Access denied. Active administrator account required.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = target_student_id and role = 'student') then
    raise exception 'Student profile not found or is not a student.';
  end if;

  if not exists (select 1 from public.courses where id = target_course_id) then
    raise exception 'Course not found.';
  end if;

  cert_num := nullif(trim(target_certificate_number), '');
  if cert_num is null then
    cert_num := 'NGDAI-' || extract(year from coalesce(target_issued_at, current_date))::text || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  end if;

  insert into public.certificates(student_id, course_id, certificate_number, issued_at)
  values(target_student_id, target_course_id, cert_num, coalesce(target_issued_at, current_date)::timestamptz)
  returning id into cert_id;

  return jsonb_build_object('success', true, 'certificate_id', cert_id, 'certificate_number', cert_num);
exception
  when unique_violation then
    raise exception 'Certificate number already exists: %', cert_num;
end;
$$;

revoke all on function public.admin_issue_certificate(uuid,uuid,text,date) from public;
grant execute on function public.admin_issue_certificate(uuid,uuid,text,date) to authenticated;

-- Certificate visibility: an active student may see certificates issued to their
-- own account without requiring a second enrollment check.
drop policy if exists "students read own certificates" on public.certificates;
create policy "students read own certificates"
on public.certificates for select to authenticated
using (student_id = auth.uid() and public.is_active_student());

-- ============================================================
-- 8. Storage guidance
-- ============================================================
-- Create these PRIVATE buckets from Supabase Storage:
--   course-materials
--   assignments
--   certificates
--
-- Do NOT store Zoom videos in GitHub Pages or Supabase Storage.
-- Keep the Zoom recording hosted by Zoom and store only its URL
-- and optional passcode in public.recordings.

-- ============================================================
-- 9. First-admin bootstrap
-- ============================================================
-- After the first user has signed up, run ONE manual bootstrap:
--
-- update public.profiles
-- set role = 'admin', status = 'active'
-- where id = 'AUTH-USER-UUID';
--
-- Verify:
-- select id, full_name, role, status from public.profiles;
-- ============================================================

-- Existing database note:
-- If your current profiles table contains status='completed', this schema
-- converts those rows to 'inactive' before applying the production check.
-- Existing course/enrollment data is preserved.
-- ============================================================
