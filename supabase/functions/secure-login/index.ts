import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = new Set(['https://nextgendevsecops.in','https://www.nextgendevsecops.in']);
function corsHeaders(origin?: string | null) { return {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin || '') ? origin! : 'https://nextgendevsecops.in',
  'Vary': 'Origin',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}; }

function json(body: unknown, status = 200, origin?: string | null) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: 'Origin not allowed' }, 403, origin);
  const contentLength = Number(req.headers.get('content-length') || '0');
  if (contentLength > 20000) return json({ error: 'Request is too large.' }, 413, origin);
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);

  try {
    const body = await req.json();
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const turnstileToken = String(body?.turnstile_token || '');

    if (!email || !password || !turnstileToken) {
      return json({ error: 'Email, password and security verification are required.' }, 400, origin);
    }

    const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = req.headers.get('apikey') || Deno.env.get('SUPABASE_ANON_KEY');

    if (!turnstileSecret || !supabaseUrl || !supabaseAnonKey) {
      console.error('secure-login configuration is incomplete');
      return json({ error: 'Secure login is not configured on the server.' }, 500, origin);
    }

    const verifyResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: turnstileSecret, response: turnstileToken }),
    });
    const verification = await verifyResponse.json();

    if (!verification?.success) {
      console.warn('Turnstile rejected secure-login request', verification?.['error-codes'] || []);
      return json({ error: 'Security verification failed. Please complete the check again.' }, 403, origin);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data?.session) {
      return json({ error: error?.message || 'Invalid login credentials.' }, 401, origin);
    }

    return json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      expires_at: data.session.expires_at,
      token_type: data.session.token_type,
      user: data.user,
    }, 200, origin);
  } catch (error) {
    console.error('secure-login error', error);
    return json({ error: 'Unable to complete secure login.' }, 500, origin);
  }
});
