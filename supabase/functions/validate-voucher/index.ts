import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = new Set(['https://nextgendevsecops.in', 'https://www.nextgendevsecops.in']);
const VERSION = 'v1.1.2-voucher-validation';
const COURSE_KEYS = new Set(['devops', 'devsecops-foundational', 'devsecops-advanced', 'genai']);

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
  return new Response(JSON.stringify({ ...body, function_version: VERSION }), { status, headers: cors(origin) });
}
function norm(value: unknown, max: number) { return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max); }

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed.' }, origin);
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json(403, { error: 'Origin not allowed.' }, origin);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceRole) return json(500, { error: 'Voucher service configuration is incomplete.' }, origin);

    const payload = await req.json();
    const courseKey = norm(payload?.course_key, 60).toLowerCase();
    const plan0 = norm(payload?.plan, 10).toLowerCase();
    const plan = plan0 === 'part' ? 'part1' : plan0;
    const code = norm(payload?.voucher_code, 80).toUpperCase();
    if (!COURSE_KEYS.has(courseKey) || !['full', 'part1'].includes(plan)) return json(400, { error: 'Invalid course or payment plan.' }, origin);
    if (!code) return json(400, { error: 'Please enter the voucher code provided to you.' }, origin);

    const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: voucher, error: voucherError } = await admin
      .from('voucher_codes')
      .select('id,code,course_key,discount_type,discount_amount,active,expires_at,max_redemptions,redeemed_count')
      .eq('code', code)
      .maybeSingle();
    if (voucherError) throw new Error(voucherError.message);
    if (!voucher || !voucher.active || (voucher.expires_at && new Date(voucher.expires_at).getTime() <= Date.now()) || Number(voucher.redeemed_count) >= Number(voucher.max_redemptions)) {
      return json(400, { error: 'Invalid, expired or already fully redeemed voucher code.', error_code: 'VOUCHER_INVALID' }, origin);
    }
    if (voucher.course_key && voucher.course_key !== courseKey) return json(400, { error: 'This voucher is not valid for the selected course.', error_code: 'VOUCHER_COURSE_MISMATCH' }, origin);

    const { data: course, error: courseError } = await admin
      .from('payment_catalog')
      .select('course_key,full_amount,part_amount,referral_amount')
      .eq('course_key', courseKey)
      .eq('active', true)
      .maybeSingle();
    if (courseError) throw new Error(courseError.message);
    if (!course) return json(400, { error: 'This course is not currently available for payment.' }, origin);

    const baseAmount = Number(plan === 'full' ? course.full_amount : course.part_amount);
    const fullAmount = Number(course.full_amount);
    const referralAmount = Number(course.referral_amount || 0);
    const discount = voucher.discount_type === 'course_referral'
      ? Math.round(referralAmount * baseAmount / fullAmount)
      : Number(voucher.discount_amount || 0);
    if (!Number.isSafeInteger(baseAmount) || !Number.isSafeInteger(discount) || discount <= 0 || discount >= baseAmount) return json(400, { error: 'This voucher has no valid discount for the selected payment.' }, origin);

    return json(200, {
      valid: true,
      code: voucher.code,
      discount,
      base_amount: baseAmount,
      payable_amount: baseAmount - discount,
      message: `Referral voucher applied. You save ₹${discount.toLocaleString('en-IN')}.`,
    }, origin);
  } catch (error) {
    console.error('validate-voucher failure', error);
    return json(500, { error: 'Unable to validate the voucher right now. Please try again.', error_code: 'VOUCHER_SERVICE_ERROR' }, origin);
  }
});
