import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://mmukul.github.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const COURSE_KEYS = new Set(['devops','devsecops-foundational','devsecops-advanced','genai']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UTR_RE = /^[A-Za-z0-9][A-Za-z0-9._\-/ ]{5,63}$/;
const PHONE_RE = /^[+0-9()\-\s]{7,20}$/;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function normalize(value: unknown, max: number) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function normalizeUtr(value: string) {
  return value.replace(/[\s._\-/]/g, '').toUpperCase();
}

async function verifyTurnstile(token: string, ip?: string) {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) throw new Error('Payment security is not configured. Please contact the administrator.');
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  if (!response.ok) return false;
  const result = await response.json();
  return result.success === true;
}

function makeReference() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `PAY-${Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed.' });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) return json(500, { error: 'Payment service is not configured.' });

    const payload = await req.json();
    const courseKey = normalize(payload?.course_key, 60).toLowerCase();
    const name = normalize(payload?.name, 100);
    const email = normalize(payload?.email, 254).toLowerCase();
    const phone = normalize(payload?.phone, 20);
    const utr = normalize(payload?.utr, 64);
    const plan = payload?.plan === 'part' ? 'part1' : 'full';
    const turnstileToken = normalize(payload?.turnstile_token, 4096);

    if (!COURSE_KEYS.has(courseKey)) return json(400, { error: 'Invalid course selection.' });
    if (name.length < 2) return json(400, { error: 'A valid name is required.' });
    if (!EMAIL_RE.test(email)) return json(400, { error: 'A valid email address is required.' });
    if (phone && !PHONE_RE.test(phone)) return json(400, { error: 'Invalid phone number.' });
    if (!UTR_RE.test(utr)) return json(400, { error: 'Invalid UTR / transaction reference.' });
    if (!turnstileToken) return json(400, { error: 'Security verification is required.' });

    const verifiedCaptcha = await verifyTurnstile(turnstileToken, req.headers.get('cf-connecting-ip') ?? undefined);
    if (!verifiedCaptcha) return json(403, { error: 'Security verification failed. Please try again.' });

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: course, error: courseError } = await admin
      .from('payment_catalog')
      .select('course_key,course_name,full_amount,part_amount,active')
      .eq('course_key', courseKey)
      .eq('active', true)
      .maybeSingle();
    if (courseError) throw courseError;
    if (!course) return json(400, { error: 'This course is not currently available for payment.' });

    const utrNormalized = normalizeUtr(utr);
    const { data: existingUtr, error: utrError } = await admin
      .from('payment_submissions').select('id').eq('utr_normalized', utrNormalized).maybeSingle();
    if (utrError) throw utrError;
    if (existingUtr) return json(409, { error: 'This UTR has already been submitted.' });

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: rateError } = await admin
      .from('payment_submissions').select('id', { count: 'exact', head: true })
      .eq('payer_email', email).gte('created_at', hourAgo);
    if (rateError) throw rateError;
    if ((count ?? 0) >= 5) return json(429, { error: 'Too many payment submissions for this email. Please try again later.' });

    const amount = Number(plan === 'part1' ? course.part_amount : course.full_amount);
    if (!Number.isFinite(amount) || amount <= 0) return json(500, { error: 'Course payment amount is not configured correctly.' });

    const reference = makeReference();
    const { error: insertError } = await admin.from('payment_submissions').insert({
      reference,
      course_key: course.course_key,
      course_name: course.course_name,
      payer_name: name,
      payer_email: email,
      payer_phone: phone || null,
      plan,
      amount,
      utr,
      utr_normalized: utrNormalized,
      status: 'pending',
    });
    if (insertError) {
      if (insertError.code === '23505') return json(409, { error: 'This UTR or payment reference has already been submitted.' });
      throw insertError;
    }

    return json(201, { reference, amount, status: 'pending' });
  } catch (error) {
    console.error('submit-payment:', error);
    return json(500, { error: 'Unable to submit the payment for verification. Please try again.' });
  }
});
