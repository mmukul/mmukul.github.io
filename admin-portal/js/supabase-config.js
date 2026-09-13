// NextGen DevSecOps AI — Supabase configuration
// Frontend-safe Publishable/Anon key only.
// NEVER put the Supabase service_role/secret key in this file.

window.NEXTGEN_SUPABASE_URL =
  "https://hkpvigvtdckxhmnsvdrh.supabase.co";

window.NEXTGEN_SUPABASE_ANON_KEY =
  "sb_publishable_JlIrNdsEXgjikrh9F_YxYg_DBrgimoQ";

window.NEXTGEN_SUPABASE_CONFIGURED = Boolean(
  window.NEXTGEN_SUPABASE_URL &&
  window.NEXTGEN_SUPABASE_ANON_KEY
);

// Compatibility aliases
window.SUPABASE_URL = window.NEXTGEN_SUPABASE_URL;
window.SUPABASE_ANON_KEY = window.NEXTGEN_SUPABASE_ANON_KEY;
window.SUPABASE_CONFIGURED = window.NEXTGEN_SUPABASE_CONFIGURED;
