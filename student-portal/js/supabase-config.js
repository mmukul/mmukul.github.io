// NextGen DevSecOps AI — Supabase + Turnstile configuration
// Frontend-safe values only. NEVER put a Supabase service_role/secret key here.

window.NEXTGEN_SUPABASE_URL =
  "https://hkpvigvtdckxhmnsvdrh.supabase.co";

window.NEXTGEN_SUPABASE_ANON_KEY =
  "sb_publishable_JlIrNdsEXgjikrh9F_YxYg_DBrgimoQ";

// Production Cloudflare Turnstile sitekey used by the public website
// and Student/Admin login pages.
window.NEXTGEN_TURNSTILE_SITE_KEY =
  "0x4AAAAAAFB-n4TRFrZBKY3q";

window.NEXTGEN_SUPABASE_CONFIGURED = Boolean(
  window.NEXTGEN_SUPABASE_URL &&
  window.NEXTGEN_SUPABASE_ANON_KEY
);

window.SUPABASE_URL = window.NEXTGEN_SUPABASE_URL;
window.SUPABASE_ANON_KEY = window.NEXTGEN_SUPABASE_ANON_KEY;
window.SUPABASE_CONFIGURED = window.NEXTGEN_SUPABASE_CONFIGURED;
