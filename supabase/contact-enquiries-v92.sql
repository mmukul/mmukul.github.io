-- v92: server-side contact/enquiry capture.
create table if not exists public.contact_enquiries (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  context text not null,
  course text,
  name text not null,
  email text not null,
  phone text not null,
  preferred_engagement text,
  goal text,
  status text not null default 'new' check (status in ('new','in_progress','closed','spam')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_contact_enquiries_status_created on public.contact_enquiries(status,created_at desc);
create index if not exists idx_contact_enquiries_email on public.contact_enquiries(lower(email));
alter table public.contact_enquiries enable row level security;
revoke all on table public.contact_enquiries from anon, authenticated;
grant select,update on table public.contact_enquiries to authenticated;
drop policy if exists contact_enquiries_admin_select on public.contact_enquiries;
create policy contact_enquiries_admin_select on public.contact_enquiries for select to authenticated using (public.is_admin());
drop policy if exists contact_enquiries_admin_update on public.contact_enquiries;
create policy contact_enquiries_admin_update on public.contact_enquiries for update to authenticated using (public.is_admin()) with check (public.is_admin());
create or replace function public.touch_contact_enquiry_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists trg_contact_enquiry_updated_at on public.contact_enquiries;
create trigger trg_contact_enquiry_updated_at before update on public.contact_enquiries for each row execute function public.touch_contact_enquiry_updated_at();
