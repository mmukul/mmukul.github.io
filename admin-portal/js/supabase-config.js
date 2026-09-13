/**
 * NextGen DevSecOps AI
 * Supabase Configuration
 *
 * IMPORTANT:
 * - Use only the Supabase Publishable/Anon key here.
 * - NEVER put the service_role/secret key in this file.
 */

(function () {
  "use strict";

  const SUPABASE_URL =
    "https://hkpvigvtdckxhmnsvdrh.supabase.co";

  const SUPABASE_ANON_KEY =
    "sb_publishable_JlIrNdsEXgjikrh9F_YxYg_DBrgimoQ";

  // Expose configuration globally
  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

  // Backward-compatible aliases
  window.supabaseUrl = SUPABASE_URL;
  window.supabaseAnonKey = SUPABASE_ANON_KEY;

  // Configuration validation
  window.SUPABASE_CONFIGURED =
    Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

  if (!window.SUPABASE_CONFIGURED) {
    console.error(
      "Supabase configuration is missing. Please update admin-portal/js/supabase-config.js"
    );
  } else {
    console.log("✓ Supabase configuration loaded");
  }
})();
