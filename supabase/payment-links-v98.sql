-- v98: server-created Razorpay Payment Links for course-specific amounts.
-- Run after payment-gateway-v92.sql.

alter table public.gateway_payment_orders
  add column if not exists gateway_payment_link_id text;

create unique index if not exists uq_gateway_payment_orders_link_id
  on public.gateway_payment_orders(gateway_payment_link_id)
  where gateway_payment_link_id is not null;

comment on column public.gateway_payment_orders.gateway_payment_link_id is
  'Razorpay Payment Link id created server-side; never supplied by the browser.';
