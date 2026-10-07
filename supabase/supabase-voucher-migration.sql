-- v1.1.2 referral voucher support
-- Run this migration in the Supabase SQL Editor before deploying the updated Edge Functions.

alter table public.payment_catalog
  add column if not exists referral_amount integer not null default 0;

update public.payment_catalog set referral_amount = 4000 where course_key = 'devops';
update public.payment_catalog set referral_amount = 5000 where course_key = 'devsecops-foundational';
update public.payment_catalog set referral_amount = 5000 where course_key = 'devsecops-advanced';
update public.payment_catalog set referral_amount = 6000 where course_key = 'genai';

create table if not exists public.voucher_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  course_key text null,
  discount_type text not null default 'course_referral' check (discount_type in ('course_referral','fixed')),
  discount_amount integer not null default 0 check (discount_amount >= 0),
  active boolean not null default true,
  expires_at timestamptz null,
  max_redemptions integer not null default 1 check (max_redemptions > 0),
  redeemed_count integer not null default 0 check (redeemed_count >= 0),
  created_by text null,
  created_at timestamptz not null default now()
);

create index if not exists voucher_codes_code_idx on public.voucher_codes (code);
create index if not exists voucher_codes_active_idx on public.voucher_codes (active);

alter table public.gateway_payment_orders
  add column if not exists base_amount integer,
  add column if not exists discount_amount integer not null default 0,
  add column if not exists voucher_code text,
  add column if not exists voucher_id uuid references public.voucher_codes(id);

alter table public.voucher_codes enable row level security;

create or replace function public.redeem_voucher(p_voucher_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_redeemed integer;
  v_max integer;
begin
  select redeemed_count, max_redemptions
    into v_redeemed, v_max
    from public.voucher_codes
   where id = p_voucher_id
     and active = true
     and (expires_at is null or expires_at > now())
   for update;

  if not found or v_redeemed >= v_max then
    return false;
  end if;

  update public.voucher_codes
     set redeemed_count = redeemed_count + 1
   where id = p_voucher_id;

  return true;
end;
$$;

revoke all on function public.redeem_voucher(uuid) from public;
revoke all on function public.redeem_voucher(uuid) from anon;
revoke all on function public.redeem_voucher(uuid) from authenticated;

grant execute on function public.redeem_voucher(uuid) to service_role;

-- Admin voucher generated for this release. It is not embedded in the mobile app.
-- Give this code only to the intended student. It supports the course referral benefit
-- for any active course and can be redeemed up to 10 times before 31-Dec-2026.
insert into public.voucher_codes
  (code, course_key, discount_type, discount_amount, active, expires_at, max_redemptions, created_by)
values
  ('NEXTGEN-REF-05C2DBB47D', null, 'course_referral', 0, true, '2026-12-31T23:59:59+05:30', 10, 'admin-v1.1.2')
on conflict (code) do update set
  active = true,
  expires_at = excluded.expires_at,
  max_redemptions = excluded.max_redemptions,
  created_by = excluded.created_by;

-- Atomically mark a paid order and consume its voucher, if any.
create or replace function public.finalize_gateway_payment(
  p_order_id uuid,
  p_payment_id text,
  p_paid_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_voucher_id uuid;
  v_redeemed integer;
  v_max integer;
begin
  select status, voucher_id
    into v_status, v_voucher_id
    from public.gateway_payment_orders
   where id = p_order_id
   for update;

  if not found then return false; end if;
  if v_status = 'paid' then return true; end if;

  if v_voucher_id is not null then
    select redeemed_count, max_redemptions
      into v_redeemed, v_max
      from public.voucher_codes
     where id = v_voucher_id
       and active = true
       and (expires_at is null or expires_at > now())
     for update;
    if not found or v_redeemed >= v_max then return false; end if;
    update public.voucher_codes set redeemed_count = redeemed_count + 1 where id = v_voucher_id;
  end if;

  update public.gateway_payment_orders
     set gateway_payment_id = p_payment_id,
         status = 'paid',
         paid_at = p_paid_at
   where id = p_order_id;

  return true;
end;
$$;

revoke all on function public.finalize_gateway_payment(uuid, text, timestamptz) from public;
revoke all on function public.finalize_gateway_payment(uuid, text, timestamptz) from anon;
revoke all on function public.finalize_gateway_payment(uuid, text, timestamptz) from authenticated;
grant execute on function public.finalize_gateway_payment(uuid, text, timestamptz) to service_role;
