-- Secure UPI + UTR/manual-payment workflow for NextGen DevSecOps AI
-- Run once in Supabase SQL Editor after reviewing the course prices below.

create table if not exists public.payment_catalog (
  course_key text primary key,
  course_name text not null,
  full_amount numeric(12,2) not null check (full_amount > 0),
  part_amount numeric(12,2) not null check (part_amount > 0 and part_amount <= full_amount),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.payment_catalog(course_key,course_name,full_amount,part_amount,active)
values
 ('devops','DevOps Training',20000,10000,true),
 ('devsecops-foundational','DevSecOps & Application Security — Foundational',25000,12500,true),
 ('devsecops-advanced','DevSecOps & Application Security — Advanced',30000,15000,true),
 ('genai','GenAI & AI Security',25000,12500,true)
on conflict (course_key) do update set
 course_name=excluded.course_name,
 full_amount=excluded.full_amount,
 part_amount=excluded.part_amount,
 active=excluded.active,
 updated_at=now();

create table if not exists public.payment_submissions (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  course_key text not null references public.payment_catalog(course_key),
  course_name text not null,
  payer_name text not null,
  payer_email text not null,
  payer_phone text,
  plan text not null check (plan in ('full','part1','part2')),
  amount numeric(12,2) not null check (amount > 0),
  utr text not null,
  utr_normalized text not null unique,
  status text not null default 'pending' check (status in ('pending','verified','rejected','refunded')),
  admin_notes text,
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payment_submissions_status on public.payment_submissions(status,created_at desc);
create index if not exists idx_payment_submissions_email on public.payment_submissions(lower(payer_email));
create index if not exists idx_payment_submissions_course on public.payment_submissions(course_key,created_at desc);

alter table public.payment_catalog enable row level security;
alter table public.payment_submissions enable row level security;

-- The public website never writes directly to payment_submissions. The Edge Function
-- uses the service role after server-side validation. Admins can review/update payments.
revoke all on table public.payment_catalog from anon, authenticated;
revoke all on table public.payment_submissions from anon, authenticated;
grant select on table public.payment_submissions to authenticated;
grant select, update on table public.payment_catalog to authenticated;

drop policy if exists payment_catalog_admin_select on public.payment_catalog;
create policy payment_catalog_admin_select on public.payment_catalog
for select to authenticated using (public.is_admin());

drop policy if exists payment_submissions_admin_select on public.payment_submissions;
create policy payment_submissions_admin_select on public.payment_submissions
for select to authenticated using (public.is_admin());

drop policy if exists payment_submissions_admin_update on public.payment_submissions;
create policy payment_submissions_admin_update on public.payment_submissions
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.touch_payment_submission_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end; $$;

drop trigger if exists trg_payment_submission_updated_at on public.payment_submissions;
create trigger trg_payment_submission_updated_at
before update on public.payment_submissions
for each row execute function public.touch_payment_submission_updated_at();

comment on table public.payment_submissions is 'Server-created UPI/UTR submissions. Students/public clients cannot insert, update, or read rows directly.';
comment on column public.payment_submissions.status is 'Only admins may change payment status; verified means manually reconciled against the bank/UPI transaction.';
