import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = new Set([
  'https://nextgendevsecops.in',
  'https://www.nextgendevsecops.in',
]);
const VERSION = 'v1.1.2-secure-razorpay-order-voucher';
const COURSE_KEYS = new Set(['devops', 'devsecops-foundational', 'devsecops-advanced', 'genai']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+0-9()\-\s]{7,20}$/;

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

function norm(value: unknown, max: number) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function reference() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `RZ-${Array.from(bytes).map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

async function verifyTurnstile(token: string, remoteIp?: string | null) {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) throw new Error('Turnstile secret is not configured.');
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set('remoteip', remoteIp);
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success !== true) {
    throw new Error(`Turnstile verification failed: ${Array.isArray(data?.['error-codes']) ? data['error-codes'].join(',') : 'invalid-token'}`);
  }
}

function errorCode(error: unknown) {
  const text = String((error as any)?.message || error || '').toLowerCase();
  if (text.includes('razorpay')) return 'RAZORPAY_ERROR';
  if (text.includes('payment_catalog')) return 'CATALOG_ERROR';
  if (text.includes('gateway_payment_orders')) return 'PAYMENT_RECORD_ERROR';
  if (text.includes('configured')) return 'CONFIG_ERROR';
  return 'GATEWAY_ORDER_ERROR';
}

async function razor(path: string, init: RequestInit) {
  const key = Deno.env.get('RAZORPAY_KEY_ID');
  const secret = Deno.env.get('RAZORPAY_KEY_SECRET');
  if (!key || !secret) throw new Error('Razorpay credentials are not configured.');

  const auth = btoa(`${key}:${secret}`);
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const description = String(data?.error?.description || 'Razorpay rejected the order request.');
    const err = new Error(`Razorpay HTTP ${response.status}: ${description}`);
    (err as any).gatewayStatus = response.status;
    throw err;
  }
  return data;
}

Deno.serve(async req => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method === 'GET') return json(200, { ok: true, service: 'create-razorpay-order', version: VERSION }, origin);
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed.' }, origin);
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json(403, { error: 'Origin not allowed.' }, origin);

  const contentLength = Number(req.headers.get('content-length') || '0');
  if (contentLength > 20000) return json(413, { error: 'Request is too large.' }, origin);

  let stage = 'initialization';
  try {
    stage = 'configuration';
    const url = Deno.env.get('SUPABASE_URL');
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const razorpayKey = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpaySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
    const checkoutConfigId = Deno.env.get('RAZORPAY_CHECKOUT_CONFIG_ID')?.trim();

    if (!url || !serviceRole || !razorpayKey || !razorpaySecret || !turnstileSecret) {
      console.error('CONFIG_ERROR: required payment environment variables are missing', {
        hasSupabaseUrl: !!url,
        hasServiceRole: !!serviceRole,
        hasRazorpayKey: !!razorpayKey,
        hasRazorpaySecret: !!razorpaySecret,
        hasTurnstileSecret: !!turnstileSecret,
      });
      return json(500, { error: 'Payment service configuration is incomplete.', error_code: 'CONFIG_ERROR' }, origin);
    }

    stage = 'request_validation';
    const payload = await req.json();
    const courseKey = norm(payload?.course_key, 60).toLowerCase();
    const plan0 = norm(payload?.plan, 10).toLowerCase();
    const plan = plan0 === 'part' ? 'part1' : plan0;
    const name = norm(payload?.name, 100);
    const email = norm(payload?.email, 254).toLowerCase();
    const phone = norm(payload?.phone, 20);
    const turnstileToken = norm(payload?.turnstile_token, 2048);

    if (!turnstileToken) return json(400, { error: 'Please complete the security check.', error_code: 'TURNSTILE_REQUIRED' }, origin);
    if (!COURSE_KEYS.has(courseKey) || !['full', 'part1', 'part2'].includes(plan)) {
      return json(400, { error: 'Invalid course or payment plan.', error_code: 'VALIDATION_ERROR' }, origin);
    }
    if (name.length < 2 || !EMAIL_RE.test(email) || (phone && !PHONE_RE.test(phone))) {
      return json(400, { error: 'Please provide valid payment details.', error_code: 'VALIDATION_ERROR' }, origin);
    }

    stage = 'turnstile_verification';
    await verifyTurnstile(turnstileToken, req.headers.get('cf-connecting-ip'));

    stage = 'supabase_client';
    const admin = createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    stage = 'rate_limit_check';
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: rateError } = await admin
      .from('gateway_payment_orders')
      .select('id', { count: 'exact', head: true })
      .eq('payer_email', email)
      .gte('created_at', hourAgo);
    if (rateError) throw new Error(`gateway_payment_orders rate-limit query failed: ${rateError.message}`);
    if ((count ?? 0) >= 5) return json(429, { error: 'Too many payment attempts for this email. Please try again later.', error_code: 'RATE_LIMIT_ERROR' }, origin);

    stage = 'course_lookup';
    const { data: course, error: courseError } = await admin
      .from('payment_catalog')
      .select('course_key,course_name,full_amount,part_amount,referral_amount,active')
      .eq('course_key', courseKey)
      .eq('active', true)
      .maybeSingle();
    if (courseError) throw new Error(`payment_catalog lookup failed: ${courseError.message}`);
    if (!course) return json(400, { error: 'This course is not currently available for payment.', error_code: 'COURSE_UNAVAILABLE' }, origin);

    stage = 'installment_validation';
    if (plan === 'part2') {
      const { data: prior, error: priorError } = await admin
        .from('gateway_payment_orders')
        .select('id')
        .eq('course_key', courseKey)
        .eq('payer_email', email)
        .eq('plan', 'part1')
        .eq('status', 'paid')
        .limit(1)
        .maybeSingle();
      if (priorError) throw new Error(`Part 1 verification lookup failed: ${priorError.message}`);
      if (!prior) return json(400, { error: 'Part 2 can be paid after Part 1 has been verified as paid.', error_code: 'PART1_REQUIRED' }, origin);
    }

    stage = 'amount_validation';
    const baseAmount = Number(plan === 'full' ? course.full_amount : course.part_amount);
    const full = Number(course.full_amount);
    const part = Number(course.part_amount);
    const referralAmount = Number(course.referral_amount || 0);
    if (!Number.isSafeInteger(full) || !Number.isSafeInteger(part) || part <= 0 || part > full || !Number.isSafeInteger(baseAmount) || baseAmount <= 0 || !Number.isSafeInteger(referralAmount) || referralAmount < 0) {
      console.error('CATALOG_ERROR: invalid payment amounts', { courseKey, plan, full, part, baseAmount, referralAmount });
      return json(500, { error: 'Course payment configuration is invalid.', error_code: 'CATALOG_ERROR' }, origin);
    }

    stage = 'voucher_validation';
    const voucherCode = norm(payload?.voucher_code, 80).toUpperCase();
    let voucherId: string | null = null;
    let discountAmount = 0;
    if (voucherCode) {
      const { data: voucher, error: voucherError } = await admin
        .from('voucher_codes')
        .select('id,code,course_key,discount_type,discount_amount,assigned_email,active,expires_at,max_redemptions,redeemed_count')
        .eq('code', voucherCode)
        .maybeSingle();
      if (voucherError) throw new Error(`voucher_codes lookup failed: ${voucherError.message}`);
      if (!voucher || !voucher.active || (voucher.expires_at && new Date(voucher.expires_at).getTime() <= Date.now()) || Number(voucher.redeemed_count) >= Number(voucher.max_redemptions)) {
        return json(400, { error: 'Invalid, expired or already fully redeemed voucher code.', error_code: 'VOUCHER_INVALID' }, origin);
      }
      if (plan === 'part2') return json(400, { error: 'Referral vouchers are available for Full Payment or Part 1 only.', error_code: 'VOUCHER_PART2_NOT_ALLOWED' }, origin);
      if (voucher.course_key && voucher.course_key !== courseKey) return json(400, { error: 'This voucher is not valid for the selected course.', error_code: 'VOUCHER_COURSE_MISMATCH' }, origin);
      if (!voucher.assigned_email || String(voucher.assigned_email).toLowerCase() !== email) return json(400, { error: 'This voucher is assigned to a different student email.', error_code: 'VOUCHER_STUDENT_MISMATCH' }, origin);
      discountAmount = voucher.discount_type === 'course_referral'
        ? referralAmount
        : Number(voucher.discount_amount || 0);
      if (!Number.isSafeInteger(discountAmount) || discountAmount <= 0 || discountAmount >= baseAmount) return json(400, { error: 'This voucher has no valid discount for the selected payment.', error_code: 'VOUCHER_AMOUNT_INVALID' }, origin);
      voucherId = String(voucher.id);
    }
    const amount = baseAmount - discountAmount;

    stage = 'razorpay_order';
    const ref = reference();
    const orderPayload = {
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: ref,
      notes: { reference: ref, course_key: courseKey, plan, payer_email: email, voucher_code: voucherCode || '', discount_amount: String(discountAmount) },
      payment_capture: 1,
      ...(checkoutConfigId ? { checkout_config_id: checkoutConfigId } : {}),
    };

    let order;
    let checkoutConfigApplied = false;
    try {
      order = await razor('/orders', { method: 'POST', body: JSON.stringify(orderPayload) });
      checkoutConfigApplied = Boolean(checkoutConfigId);
    } catch (configError) {
      // A stale/mismatched Checkout Configuration ID must not make the entire gateway unusable.
      // The order is not created when Razorpay rejects the request, so retrying without the optional
      // configuration is safe and lets Razorpay use the account's active/default Checkout settings.
      if (!checkoutConfigId) throw configError;
      console.error('RAZORPAY_CHECKOUT_CONFIG_FALLBACK', {
        message: String((configError as any)?.message || configError),
      });
      const { checkout_config_id: _ignored, ...fallbackPayload } = orderPayload as Record<string, unknown>;
      order = await razor('/orders', { method: 'POST', body: JSON.stringify(fallbackPayload) });
      checkoutConfigApplied = false;
    }

    if (!order?.id || !Number.isSafeInteger(Number(order?.amount)) || Number(order.amount) <= 0) {
      throw new Error('Razorpay returned an invalid order response.');
    }

    stage = 'payment_record';
    const { error: insertError } = await admin.from('gateway_payment_orders').insert({
      reference: ref,
      gateway: 'razorpay',
      gateway_order_id: order.id,
      course_key: course.course_key,
      course_name: course.course_name,
      payer_name: name,
      payer_email: email,
      payer_phone: phone || null,
      plan,
      amount,
      base_amount: baseAmount,
      discount_amount: discountAmount,
      voucher_code: voucherCode || null,
      voucher_id: voucherId,
      currency: 'INR',
      status: 'created',
    });
    if (insertError) throw new Error(`gateway_payment_orders insert failed: ${insertError.message}`);

    return json(201, {
      ok: true,
      reference: ref,
      order_id: order.id,
      amount: Number(order.amount),
      amount_rupees: amount,
      base_amount_rupees: baseAmount,
      discount_amount_rupees: discountAmount,
      voucher_code: voucherCode || null,
      currency: order.currency || 'INR',
      plan,
      key_id: razorpayKey,
      checkout_config_applied: checkoutConfigApplied,
    }, origin);
  } catch (error) {
    const code = errorCode(error);
    console.error('create-razorpay-order failure', {
      version: VERSION,
      stage,
      error_code: code,
      message: String((error as any)?.message || error),
      gateway_status: (error as any)?.gatewayStatus || null,
    });

    const publicMessage = code === 'RAZORPAY_ERROR'
      ? 'Razorpay could not create the payment order. Please verify the Razorpay configuration and try again.'
      : code === 'CATALOG_ERROR'
        ? 'The course payment configuration needs attention.'
        : code === 'PAYMENT_RECORD_ERROR'
          ? 'The payment order could not be recorded. Please try again.'
          : 'Unable to start secure payment. Please try again.';

    return json(500, { error: publicMessage, error_code: code, stage }, origin);
  }
});
