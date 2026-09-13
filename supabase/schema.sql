-- NextGen DevSecOps AI — Production LMS Schema
-- Source of truth for the Student LMS + Admin Portal.
-- Safe to run on the existing project: policies are recreated, seed courses use upsert semantics.
-- NEVER put the Supabase service_role/secret key in GitHub Pages.

create extension if not exists pgcrypto;

-- =========================================================
-- Core tables
-- =========================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  student_id text unique,
  full_name text not null,
  phone text,
  role text not null default 'student',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

-- Normalize older installations.
alter table public.profiles add column if not exists role text not null default 'student';
alter table public.profiles add column if not exists status text not null default 'active';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('student','admin'));
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check check (status in ('active','inactive'));
update public.profiles set status='inactive' where status='completed';

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
  status text not null default 'planned' check (status in ('planned','active','completed')),
  created_at timestamptz not null default now()
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete set null,
  status text not null default 'active' check (status in ('active','completed','cancelled')),
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
  status text not null default 'submitted' check (status in ('submitted','reviewed','returned')),
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

create table if not exists public.recordings (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  recording_url text not null,
  passcode text,
  session_date date,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  published boolean not null default true,
  created_at timestamptz not null default now()
);

-- =========================================================
-- Seed courses
-- =========================================================
insert into public.courses (name, slug, description) values
('DevOps','devops','Practical DevOps training'),
('DevSecOps & AppSec','devsecops-appsec','Foundational, Intermediate and Advanced DevSecOps & AppSec training'),
('GenAI & AI Security','genai-ai-security','Practical Generative AI and AI Security training')
on conflict (slug) do update set name=excluded.name, description=excluded.description;

-- =========================================================
-- Helper functions (SECURITY DEFINER avoids RLS recursion)
-- =========================================================
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id=auth.uid() and p.role='admin' and p.status='active'
  );
$$;

create or replace function public.is_active_student()
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id=auth.uid() and p.role='student' and p.status='active'
  );
$$;

create or replace function public.is_enrolled_in_course(target_course_id uuid)
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists (
    select 1 from public.enrollments e
    where e.student_id=auth.uid()
      and e.course_id=target_course_id
      and e.status in ('active','completed')
  );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_active_student() from public;
revoke all on function public.is_enrolled_in_course(uuid) from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_active_student() to authenticated;
grant execute on function public.is_enrolled_in_course(uuid) to authenticated;

-- =========================================================
-- New Auth user -> profile
-- =========================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  insert into public.profiles (id, full_name, phone, student_id, role, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email,''),'@',1)),
    nullif(new.raw_user_meta_data->>'phone',''),
    nullif(new.raw_user_meta_data->>'student_id',''),
    'student', 'active'
  )
  on conflict (id) do update set
    full_name=coalesce(nullif(excluded.full_name,''),public.profiles.full_name),
    phone=coalesce(excluded.phone,public.profiles.phone),
    student_id=coalesce(excluded.student_id,public.profiles.student_id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- =========================================================
-- RLS
-- =========================================================
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

-- Remove policies created by previous versions. Missing policies are harmless.
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
           where schemaname='public' and tablename in
           ('profiles','courses','batches','enrollments','modules','lessons','progress','assignments','submissions','certificates','recordings')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Profiles: students can view/update safe profile fields only; admins manage all.
create policy profiles_student_select on public.profiles
for select to authenticated using (id=auth.uid() or public.is_admin());
create policy profiles_student_update on public.profiles
for update to authenticated using (id=auth.uid() and role='student')
with check (id=auth.uid() and role='student' and status='active');
create policy profiles_admin_all on public.profiles
for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Courses: students see only enrolled courses; admins see/manage all.
create policy courses_student_select on public.courses
for select to authenticated using (public.is_active_student() and public.is_enrolled_in_course(id));
create policy courses_admin_all on public.courses
for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Batches: students see their enrolled batch; admins manage all.
create policy batches_student_select on public.batches
for select to authenticated using (
  public.is_active_student() and exists (
    select 1 from public.enrollments e where e.student_id=auth.uid() and e.batch_id=batches.id and e.status in ('active','completed')
  )
);
create policy batches_admin_all on public.batches
for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Enrollments: student sees own; admin manages all.
create policy enrollments_student_select on public.enrollments
for select to authenticated using (student_id=auth.uid() and public.is_active_student());
create policy enrollments_admin_all on public.enrollments
for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Course content is visible only for enrolled active students.
create policy modules_student_select on public.modules
for select to authenticated using (public.is_active_student() and public.is_enrolled_in_course(course_id));
create policy modules_admin_all on public.modules
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy lessons_student_select on public.lessons
for select to authenticated using (
  public.is_active_student() and exists (
    select 1 from public.modules m where m.id=lessons.module_id and public.is_enrolled_in_course(m.course_id)
  )
);
create policy lessons_admin_all on public.lessons
for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Progress: student-owned and only for enrolled lessons.
create policy progress_student_select on public.progress
for select to authenticated using (student_id=auth.uid() and public.is_active_student());
create policy progress_student_insert on public.progress
for insert to authenticated with check (
  student_id=auth.uid() and public.is_active_student() and exists (
    select 1 from public.lessons l join public.modules m on m.id=l.module_id where l.id=lesson_id and public.is_enrolled_in_course(m.course_id)
  )
);
create policy progress_student_update on public.progress
for update to authenticated using (student_id=auth.uid() and public.is_active_student())
with check (student_id=auth.uid() and public.is_active_student());
create policy progress_admin_all on public.progress
for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Assignments: only enrolled students; admins manage.
create policy assignments_student_select on public.assignments
for select to authenticated using (public.is_active_student() and public.is_enrolled_in_course(course_id));
create policy assignments_admin_all on public.assignments
for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Submissions: students own their submissions; admins manage.
create policy submissions_student_select on public.submissions
for select to authenticated using (student_id=auth.uid() and public.is_active_student());
create policy submissions_student_insert on public.submissions
for insert to authenticated with check (
  student_id=auth.uid() and public.is_active_student() and exists (
    select 1 from public.assignments a where a.id=assignment_id and public.is_enrolled_in_course(a.course_id)
  )
);
create policy submissions_student_update on public.submissions
for update to authenticated using (student_id=auth.uid() and public.is_active_student())
with check (student_id=auth.uid() and public.is_active_student());
create policy submissions_admin_all on public.submissions
for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Certificates: student-owned; admins manage.
create policy certificates_student_select on public.certificates
for select to authenticated using (student_id=auth.uid() and public.is_active_student());
create policy certificates_admin_all on public.certificates
for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Zoom recordings: active enrolled students only; admins manage/publish.
create policy recordings_student_select on public.recordings
for select to authenticated using (
  published=true and public.is_active_student() and public.is_enrolled_in_course(course_id)
);
create policy recordings_admin_all on public.recordings
for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Helpful indexes.
create index if not exists idx_enrollments_student on public.enrollments(student_id);
create index if not exists idx_enrollments_course on public.enrollments(course_id);
create index if not exists idx_modules_course on public.modules(course_id);
create index if not exists idx_lessons_module on public.lessons(module_id);
create index if not exists idx_progress_student on public.progress(student_id);
create index if not exists idx_assignments_course on public.assignments(course_id);
create index if not exists idx_submissions_student on public.submissions(student_id);
create index if not exists idx_certificates_student on public.certificates(student_id);
create index if not exists idx_recordings_course_date on public.recordings(course_id, session_date desc);

-- =========================================================
-- First admin bootstrap
-- =========================================================
-- After creating/signing in the first admin Auth user, run:
-- update public.profiles set role='admin', status='active' where id='AUTH-USER-UUID';
