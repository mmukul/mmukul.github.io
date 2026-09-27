import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://nextgendevsecops.in',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json();
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const turnstileToken = String(body?.turnstile_token || '');

    if (!email || !password || !turnstileToken) {
      return json({ error: 'Email, password and security verification are required.' }, 400);
    }

    const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!turnstileSecret || !supabaseUrl || !supabaseAnonKey) {
      console.error('secure-login configuration is incomplete');
      return json({ error: 'Secure login is not configured on the server.' }, 500);
    }

    const verifyResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: turnstileSecret, response: turnstileToken }),
    });
    const verification = await verifyResponse.json();

    if (!verification?.success) {
      console.warn('Turnstile rejected secure-login request', verification?.['error-codes'] || []);
      return json({ error: 'Security verification failed. Please complete the check again.' }, 403);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data?.session) {
      return json({ error: error?.message || 'Invalid login credentials.' }, 401);
    }

    return json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      expires_at: data.session.expires_at,
      token_type: data.session.token_type,
      user: data.user,
    });
  } catch (error) {
    console.error('secure-login error', error);
    return json({ error: 'Unable to complete secure login.' }, 500);
  }
});
