import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = new Set([
  'https://nextgendevsecops.in',
  'https://www.nextgendevsecops.in',
]);
const VERSION = 'v104-secure-razorpay-verify-installments';

function cors(origin?: string | null) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin || '') ? origin! : 'https://nextgendevsecops.in',
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

function json(status: number, body: Record<string, unknown>, origin?: string | null) {
  return new Response(JSON.stringify({ ...body, function_version: VERSION }), {
    status,
    headers: cors(origin),
  });
}

async function hmac(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature)).map(x => x.toString(16).padStart(2, '0')).join('');
}

async function razorPayment(paymentId: string, key: string, secret: string) {
  const auth = btoa(`${key}:${secret}`);
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method === 'GET') return json(200, { ok: true, service: 'verify-razorpay-payment', version: VERSION }, origin);
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed.' }, origin);
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json(403, { error: 'Origin not allowed.' }, origin);

  const contentLength = Number(req.headers.get('content-length') || '0');
  if (contentLength > 10000) return json(413, { error: 'Request is too large.' }, origin);

  let stage = 'initialization';
  try {
    stage = 'configuration';
    const url = Deno.env.get('SUPABASE_URL');
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const secret = Deno.env.get('RAZORPAY_KEY_SECRET');
    const key = Deno.env.get('RAZORPAY_KEY_ID');
    if (!url || !serviceRole || !secret || !key) {
      console.error('CONFIG_ERROR: verification environment variables are missing', {
        hasSupabaseUrl: !!url,
        hasServiceRole: !!serviceRole,
        hasRazorpayKey: !!key,
        hasRazorpaySecret: !!secret,
      });
      return json(500, { error: 'Payment service configuration is incomplete.', error_code: 'CONFIG_ERROR' }, origin);
    }

    stage = 'request_validation';
    const payload = await req.json();
    const orderId = String(payload?.order_id || '').trim();
    const paymentId = String(payload?.payment_id || '').trim();
    const signature = String(payload?.signature || '').trim();
    if (!orderId || !paymentId || !signature || orderId.length > 80 || paymentId.length > 80 || signature.length > 128) {
      return json(400, { error: 'Incomplete payment confirmation.', error_code: 'VALIDATION_ERROR' }, origin);
    }

    stage = 'signature_verification';
    const expected = await hmac(secret, `${orderId}|${paymentId}`);
    if (expected !== signature) return json(403, { error: 'Payment signature verification failed.', error_code: 'SIGNATURE_ERROR' }, origin);

    stage = 'payment_record_lookup';
    const admin = createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: row, error: recordError } = await admin
      .from('gateway_payment_orders')
      .select('*')
      .eq('gateway_order_id', orderId)
      .maybeSingle();
    if (recordError) throw new Error(`gateway_payment_orders lookup failed: ${recordError.message}`);
    if (!row) return json(404, { error: 'Payment order not found.', error_code: 'PAYMENT_RECORD_NOT_FOUND' }, origin);
    if (row.status === 'paid') return json(200, { ok: true, status: 'paid', reference: row.reference, amount: row.amount, plan: row.plan }, origin);

    stage = 'razorpay_payment_lookup';
    const gateway = await razorPayment(paymentId, key, secret);
    if (!gateway.ok) {
      console.error('RAZORPAY_ERROR: payment lookup failed', { status: gateway.status });
      return json(502, { error: 'Unable to confirm payment status with the gateway.', error_code: 'RAZORPAY_ERROR' }, origin);
    }
    const payment = gateway.data;

    stage = 'payment_validation';
    if (String(payment?.order_id || '') !== orderId) return json(403, { error: 'Payment does not belong to this order.', error_code: 'ORDER_MISMATCH' }, origin);
    if (String(payment?.currency || '') !== 'INR') return json(400, { error: 'Unexpected payment currency.', error_code: 'CURRENCY_MISMATCH' }, origin);
    if (Number(payment?.amount) !== Math.round(Number(row.amount) * 100)) return json(400, { error: 'Payment amount does not match the server-created order.', error_code: 'AMOUNT_MISMATCH' }, origin);
    if (payment?.status !== 'captured') return json(202, { ok: true, status: payment?.status || 'processing', reference: row.reference }, origin);

    stage = 'payment_record_update';
    const { error: updateError } = await admin
      .from('gateway_payment_orders')
      .update({ gateway_payment_id: paymentId, status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', row.id)
      .neq('status', 'paid');
    if (updateError) throw new Error(`gateway_payment_orders update failed: ${updateError.message}`);

    return json(200, { ok: true, status: 'paid', reference: row.reference, amount: row.amount, plan: row.plan }, origin);
  } catch (error) {
    console.error('verify-razorpay-payment failure', {
      version: VERSION,
      stage,
      message: String((error as any)?.message || error),
    });
    return json(500, { error: 'Unable to verify the payment. Please contact the administrator.', error_code: 'GATEWAY_VERIFY_ERROR', stage }, origin);
  }
});
