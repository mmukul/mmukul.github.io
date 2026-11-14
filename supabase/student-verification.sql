-- NextGen DevSecOps AI — Student pricing verification prerequisites
-- Apply in Supabase SQL Editor before deploying the Edge Functions.

create table if not exists public.student_price_verifications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid,
  course_id uuid,
  course_key text not null,
  student_name text not null,
  student_email text not null,
  student_phone text not null,
  student_number text not null,
  institution_name text not null,
  proof_path text,
  proof_sha256 text,
  application_reference text not null unique,
  status text not null default 'pending',
  review_note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_price_verifications_status_check
    check (status in ('pending','verified','rejected','more_info_required'))
);

-- Keep existing installations compatible when the table was created earlier.
alter table public.student_price_verifications add column if not exists student_id uuid;
alter table public.student_price_verifications add column if not exists course_id uuid;
alter table public.student_price_verifications add column if not exists course_key text;
alter table public.student_price_verifications add column if not exists student_name text;
alter table public.student_price_verifications add column if not exists student_email text;
alter table public.student_price_verifications add column if not exists student_phone text;
alter table public.student_price_verifications add column if not exists student_number text;
alter table public.student_price_verifications add column if not exists institution_name text;
alter table public.student_price_verifications add column if not exists proof_path text;
alter table public.student_price_verifications add column if not exists proof_sha256 text;
alter table public.student_price_verifications add column if not exists application_reference text;
alter table public.student_price_verifications add column if not exists status text not null default 'pending';
alter table public.student_price_verifications add column if not exists review_note text;
alter table public.student_price_verifications add column if not exists reviewed_by uuid references auth.users(id);
alter table public.student_price_verifications add column if not exists reviewed_at timestamptz;
alter table public.student_price_verifications add column if not exists created_at timestamptz not null default now();
alter table public.student_price_verifications add column if not exists updated_at timestamptz not null default now();

create unique index if not exists student_price_verifications_application_reference_uidx
  on public.student_price_verifications(application_reference) where application_reference is not null;
create index if not exists student_price_verifications_email_course_idx
  on public.student_price_verifications(student_email, course_key, status);
create index if not exists student_price_verifications_created_idx
  on public.student_price_verifications(created_at desc);
create index if not exists student_price_verifications_proof_hash_idx
  on public.student_price_verifications(proof_sha256) where proof_sha256 is not null;

alter table public.student_price_verifications enable row level security;
revoke all on public.student_price_verifications from anon;
grant select, update on public.student_price_verifications to authenticated;

drop policy if exists student_price_verifications_admin_select on public.student_price_verifications;
create policy student_price_verifications_admin_select
  on public.student_price_verifications for select to authenticated
  using (public.is_admin());
drop policy if exists student_price_verifications_admin_update on public.student_price_verifications;
create policy student_price_verifications_admin_update
  on public.student_price_verifications for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Atomic fixed-window rate limiting used by submit-student-verification.
create table if not exists public.student_verification_rate_limits (
  rate_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null default 0
);
alter table public.student_verification_rate_limits enable row level security;
revoke all on public.student_verification_rate_limits from anon, authenticated;

create or replace function public.consume_student_verification_rate_limit(
  p_rate_key text, p_limit integer, p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_rate_key is null or length(p_rate_key) < 16 or p_limit < 1 or p_window_seconds < 1 then
    return false;
  end if;
  insert into public.student_verification_rate_limits(rate_key, window_started_at, request_count)
  values (p_rate_key, now(), 1)
  on conflict (rate_key) do update
    set window_started_at = case
          when public.student_verification_rate_limits.window_started_at
               + make_interval(secs => p_window_seconds) <= now() then now()
          else public.student_verification_rate_limits.window_started_at end,
        request_count = case
          when public.student_verification_rate_limits.window_started_at
               + make_interval(secs => p_window_seconds) <= now() then 1
          else public.student_verification_rate_limits.request_count + 1 end
  returning request_count into v_count;
  return v_count <= p_limit;
end;
$$;
revoke all on function public.consume_student_verification_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_student_verification_rate_limit(text, integer, integer) to service_role;

-- Private proof bucket. Only authenticated admins can read proof objects via signed URLs.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('student-verification-private', 'student-verification-private', false, 5242880,
        array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['application/pdf','image/jpeg','image/png'];

drop policy if exists student_verification_proof_admin_read on storage.objects;
create policy student_verification_proof_admin_read
  on storage.objects for select to authenticated
  using (bucket_id = 'student-verification-private' and public.is_admin());

comment on table public.student_price_verifications is
  'Student fee eligibility submissions. Public clients submit only through the submit-student-verification Edge Function.';
