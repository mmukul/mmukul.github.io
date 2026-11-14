import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = new Set([
  'https://nextgendevsecops.in',
  'https://www.nextgendevsecops.in',
]);
const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin || '') ? origin! : 'https://nextgendevsecops.in',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
  'Content-Type': 'application/json',
});
const reply = (status: number, body: Record<string, unknown>, origin: string | null) =>
  new Response(JSON.stringify(body), { status, headers: cors(origin) });

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed.' }, origin);
  if (origin && !ALLOWED_ORIGINS.has(origin)) return reply(403, { error: 'Origin not allowed.' }, origin);

  const requestId = crypto.randomUUID();
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authHeader = req.headers.get('authorization') || '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!url || !anonKey || !serviceKey) {
      console.error('delete-student-verification configuration missing', { requestId });
      return reply(500, { error: 'Deletion service is not configured. Contact the administrator.', request_id: requestId }, origin);
    }
    if (!jwt) return reply(401, { error: 'Admin sign-in is required.', request_id: requestId }, origin);

    // Validate the caller's JWT and require the same active-admin + AAL2 rule
    // used by the protected Admin Portal (public.is_admin()).
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await caller.auth.getUser(jwt);
    if (userError || !userData.user) return reply(401, { error: 'Your admin session is invalid or expired. Sign in again.', request_id: requestId }, origin);
    const { data: allowed, error: adminError } = await caller.rpc('is_admin');
    if (adminError) {
      console.error('delete-student-verification admin check failed', { requestId, code: adminError.code, message: adminError.message });
      return reply(403, { error: 'Admin authorization could not be verified. Check the is_admin() RPC and try again.', request_id: requestId }, origin);
    }
    if (allowed !== true) return reply(403, { error: 'An active administrator session with MFA is required.', request_id: requestId }, origin);

    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return reply(400, { error: 'A valid verification request ID is required.', request_id: requestId }, origin);
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: record, error: readError } = await admin
      .from('student_price_verifications').select('id,proof_path').eq('id', id).maybeSingle();
    if (readError) throw readError;
    if (!record) return reply(404, { error: 'This verification request no longer exists. Refresh the queue.', request_id: requestId }, origin);

    // Remove the row only after the service-role delete succeeds. Storage cleanup
    // is attempted afterward; a cleanup failure is reported without pretending
    // the database deletion failed or retrying a destructive row operation.
    const { data: deletedRows, error: deleteError } = await admin
      .from('student_price_verifications').delete().eq('id', id).select('id');
    if (deleteError) throw deleteError;
    if (!deletedRows?.length) return reply(409, { error: 'The request was not deleted. Refresh the queue and try again.', request_id: requestId }, origin);

    let proofCleanupPending = false;
    if (record.proof_path) {
      const { error: storageError } = await admin.storage
        .from('student-verification-private').remove([record.proof_path]);
      if (storageError) {
        proofCleanupPending = true;
        console.error('delete-student-verification proof cleanup failed', { requestId, code: storageError.name, message: storageError.message });
      }
    }
    return reply(200, {
      ok: true,
      deleted: true,
      proof_cleanup_pending: proofCleanupPending,
      message: proofCleanupPending
        ? 'Request deleted. The uploaded proof could not be removed and needs storage cleanup.'
        : 'Student verification request and uploaded proof deleted.',
      request_id: requestId,
    }, origin);
  } catch (error) {
    console.error('delete-student-verification failed', {
      requestId,
      message: error instanceof Error ? error.message : String(error),
    });
    return reply(500, { error: 'Unable to delete this verification request. Check the Edge Function logs and retry.', request_id: requestId }, origin);
  }
});
