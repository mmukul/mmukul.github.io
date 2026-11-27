-- External Labs independent product schema.
-- APPLY ONLY TO A DEDICATED EXTERNAL-LABS SUPABASE PROJECT. Never apply to NextGen project.
create extension if not exists pgcrypto;
create table if not exists public.external_organizations (
 id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
 status text not null default 'active' check(status in ('active','suspended','closed')),
 created_at timestamptz not null default now()
);
create table if not exists public.external_memberships (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.external_organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null default 'member' check(role in ('owner','admin','member')),
 created_at timestamptz not null default now(), unique(organization_id,user_id)
);
create table if not exists public.external_lab_catalog (
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.external_organizations(id) on delete cascade,
 category text not null, name text not null, description text, os_image text not null,
 cpu integer not null check(cpu between 1 and 128), ram_gb integer not null check(ram_gb between 1 and 1024),
 disk_gb integer not null check(disk_gb between 10 and 10000), region text not null default 'Chennai',
 active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.external_lab_assignments (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.external_organizations(id) on delete cascade,
 catalog_id uuid not null references public.external_lab_catalog(id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'queued' check(status in ('queued','provisioning','stopped','running','failed','expired','terminated')),
 starts_at timestamptz not null default now(), expires_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.external_vps_instances (
 id uuid primary key default gen_random_uuid(), assignment_id uuid not null unique references public.external_lab_assignments(id) on delete cascade,
 provider text not null default 'e2e' check(provider='e2e'), provider_instance_id text unique,
 public_ip inet, browser_terminal_enabled boolean not null default true, ssh_enabled boolean not null default true,
 status text not null default 'pending' check(status in ('pending','provisioning','stopped','running','failed','terminated')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.external_usage_records (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.external_organizations(id) on delete cascade,
 assignment_id uuid references public.external_lab_assignments(id) on delete set null,
 amount numeric(12,2) not null default 0 check(amount>=0), currency text not null default 'INR', description text,
 period_start timestamptz, period_end timestamptz, created_at timestamptz not null default now()
);

create or replace function public.external_is_member(target_org uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.external_memberships m join public.external_organizations o on o.id=m.organization_id where m.organization_id=target_org and m.user_id=auth.uid() and o.status='active');
$$;
create or replace function public.external_is_admin(target_org uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.external_memberships m join public.external_organizations o on o.id=m.organization_id where m.organization_id=target_org and m.user_id=auth.uid() and m.role in ('owner','admin') and o.status='active');
$$;

alter table public.external_organizations enable row level security;
alter table public.external_memberships enable row level security;
alter table public.external_lab_catalog enable row level security;
alter table public.external_lab_assignments enable row level security;
alter table public.external_vps_instances enable row level security;
alter table public.external_usage_records enable row level security;
create policy "External members read own organizations" on public.external_organizations for select to authenticated using(public.external_is_member(id));
create policy "External members read own memberships" on public.external_memberships for select to authenticated using(user_id=auth.uid() or public.external_is_admin(organization_id));
create policy "External admins manage memberships" on public.external_memberships for all to authenticated using(public.external_is_admin(organization_id)) with check(public.external_is_admin(organization_id));
create policy "External members read catalogue" on public.external_lab_catalog for select to authenticated using(organization_id is null or public.external_is_member(organization_id));
create policy "External admins manage catalogue" on public.external_lab_catalog for all to authenticated using(organization_id is not null and public.external_is_admin(organization_id)) with check(organization_id is not null and public.external_is_admin(organization_id));
create policy "External members read own assignments" on public.external_lab_assignments for select to authenticated using(user_id=auth.uid() and public.external_is_member(organization_id));
create policy "External admins manage assignments" on public.external_lab_assignments for all to authenticated using(public.external_is_admin(organization_id)) with check(public.external_is_admin(organization_id));
create policy "External members read own VPS" on public.external_vps_instances for select to authenticated using(exists(select 1 from public.external_lab_assignments a where a.id=assignment_id and a.user_id=auth.uid() and public.external_is_member(a.organization_id)));
create policy "External admins manage VPS" on public.external_vps_instances for all to authenticated using(exists(select 1 from public.external_lab_assignments a where a.id=assignment_id and public.external_is_admin(a.organization_id))) with check(exists(select 1 from public.external_lab_assignments a where a.id=assignment_id and public.external_is_admin(a.organization_id)));
create policy "External admins read usage" on public.external_usage_records for select to authenticated using(public.external_is_admin(organization_id));
revoke all on public.external_organizations,public.external_memberships,public.external_lab_catalog,public.external_lab_assignments,public.external_vps_instances,public.external_usage_records from anon;
grant select on public.external_organizations,public.external_memberships,public.external_lab_catalog,public.external_lab_assignments,public.external_vps_instances,public.external_usage_records to authenticated;
grant insert,update,delete on public.external_memberships,public.external_lab_catalog,public.external_lab_assignments,public.external_vps_instances to authenticated;
