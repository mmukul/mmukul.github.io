-- NextGen DevSecOps AI — LMS compatibility migration v36
-- Run this once in Supabase SQL Editor against an EXISTING production project.
-- It aligns the database with the current Admin/Student Portal code.

-- Recordings: canonical columns used by both portals.
alter table public.recordings add column if not exists recording_date date;
alter table public.recordings add column if not exists zoom_url text;
alter table public.recordings add column if not exists zoom_passcode text;
alter table public.recordings add column if not exists published boolean default true;
alter table public.recordings add column if not exists updated_at timestamptz default now();
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='recordings' and column_name='session_date') then
    update public.recordings set recording_date=coalesce(recording_date,session_date) where recording_date is null;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='recordings' and column_name='recording_url') then
    update public.recordings set zoom_url=coalesce(zoom_url,recording_url) where zoom_url is null;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='recordings' and column_name='passcode') then
    update public.recordings set zoom_passcode=coalesce(zoom_passcode,passcode) where zoom_passcode is null;
  end if;
end $$;

-- Lab assignments: canonical table used by Admin + Student portals.
create table if not exists public.lab_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  lab_type text not null check (lab_type in ('browser','local','aws')),
  lab_name text not null,
  access_url text,
  status text not null default 'assigned' check (status in ('assigned','active','inactive','expired')),
  assigned_at timestamptz not null default now(),
  expires_at timestamptz,
  notes text,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.lab_assignments add column if not exists access_url text;
alter table public.lab_assignments add column if not exists notes text;
alter table public.lab_assignments add column if not exists assigned_by uuid references public.profiles(id) on delete set null;
alter table public.lab_assignments add column if not exists assigned_at timestamptz default now();
alter table public.lab_assignments add column if not exists expires_at timestamptz;
alter table public.lab_assignments enable row level security;
drop policy if exists "students read own lab assignments" on public.lab_assignments;
drop policy if exists "admins manage lab assignments" on public.lab_assignments;
create policy "students read own lab assignments" on public.lab_assignments for select to authenticated using (student_id=auth.uid() and public.is_active_student());
create policy "admins manage lab assignments" on public.lab_assignments for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select,insert,update,delete on public.lab_assignments to authenticated;

-- Certificates remain protected by the existing student/course RLS policy.


-- v37 certificate access/issuance compatibility:
-- An issued certificate is a standalone credential. Do not require a current
-- enrollment for the owner to view it, and do not require enrollment to issue it.
drop policy if exists "students read own certificates" on public.certificates;
create policy "students read own certificates"
on public.certificates for select to authenticated
using (student_id = auth.uid() and public.is_active_student());
