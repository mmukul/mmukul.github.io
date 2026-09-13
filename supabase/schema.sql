-- NextGen DevSecOps AI — Student Portal LMS v1
-- Run in Supabase SQL Editor after creating a project.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  student_id text unique,
  full_name text not null,
  phone text,
  status text not null default 'active' check (status in ('active','inactive','completed')),
  created_at timestamptz not null default now()
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

-- Seed the three current courses.
insert into public.courses (name, slug, description) values
('DevOps','devops','Practical DevOps training'),
('DevSecOps & AppSec','devsecops-appsec','Foundational, Intermediate and Advanced DevSecOps & AppSec training'),
('GenAI & AI Security','genai-ai-security','Practical Generative AI and AI Security training')
on conflict (slug) do nothing;

-- RLS
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

create policy "students read own profile" on public.profiles for select using (id = auth.uid());
create policy "students update own profile" on public.profiles for update using (id = auth.uid());
create policy "authenticated read courses" on public.courses for select to authenticated using (true);
create policy "students read own enrollments" on public.enrollments for select using (student_id = auth.uid());
create policy "students read modules" on public.modules for select to authenticated using (true);
create policy "students read lessons" on public.lessons for select to authenticated using (true);
create policy "students read own progress" on public.progress for select using (student_id = auth.uid());
create policy "students write own progress" on public.progress for insert with check (student_id = auth.uid());
create policy "students update own progress" on public.progress for update using (student_id = auth.uid());
create policy "students read assignments" on public.assignments for select to authenticated using (true);
create policy "students read own submissions" on public.submissions for select using (student_id = auth.uid());
create policy "students create own submissions" on public.submissions for insert with check (student_id = auth.uid());
create policy "students read own certificates" on public.certificates for select using (student_id = auth.uid());

-- Storage buckets should be created from the Supabase dashboard:
-- course-materials (private)
-- assignments (private)
-- certificates (private)
