-- Razorpay gateway support for safer online payments.
-- Run after payment-security-v41.sql.

create table if not exists public.gateway_payment_orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  gateway text not null default 'razorpay' check (gateway = 'razorpay'),
  gateway_order_id text not null unique,
  gateway_payment_id text unique,
  course_key text not null references public.payment_catalog(course_key),
  course_name text not null,
  payer_name text not null,
  payer_email text not null,
  payer_phone text,
  plan text not null check (plan in ('full','part1','part2')),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  status text not null default 'created' check (status in ('created','paid','failed','cancelled','refunded')),
  failure_reason text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_gateway_payment_orders_status on public.gateway_payment_orders(status, created_at desc);
create index if not exists idx_gateway_payment_orders_email on public.gateway_payment_orders(lower(payer_email));
create index if not exists idx_gateway_payment_orders_course on public.gateway_payment_orders(course_key, created_at desc);

alter table public.gateway_payment_orders enable row level security;
revoke all on table public.gateway_payment_orders from anon, authenticated;
grant select, update on table public.gateway_payment_orders to authenticated;

drop policy if exists gateway_payment_orders_admin_select on public.gateway_payment_orders;
create policy gateway_payment_orders_admin_select on public.gateway_payment_orders
for select to authenticated using (public.is_admin());

drop policy if exists gateway_payment_orders_admin_update on public.gateway_payment_orders;
create policy gateway_payment_orders_admin_update on public.gateway_payment_orders
for update to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.touch_gateway_payment_order_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end; $$;

drop trigger if exists trg_gateway_payment_order_updated_at on public.gateway_payment_orders;
create trigger trg_gateway_payment_order_updated_at
before update on public.gateway_payment_orders
for each row execute function public.touch_gateway_payment_order_updated_at();

comment on table public.gateway_payment_orders is 'Server-created Razorpay orders. Browser clients cannot insert or update gateway payment state.';
