import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Missing authorization" }), { status: 401, headers: cors });

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: cors });

  const adminClient = createClient(supabaseUrl, serviceRole);
  const { data: adminProfile } = await adminClient.from("profiles").select("id,role,status").eq("id", user.id).maybeSingle();
  if (!adminProfile || adminProfile.role !== "admin" || adminProfile.status !== "active") {
    return new Response(JSON.stringify({ error: "Active administrator access required" }), { status: 403, headers: cors });
  }

  const body = await req.json();
  const email = String(body.email || "").trim().toLowerCase();
  const full_name = String(body.full_name || "").trim();
  const phone = body.phone ? String(body.phone).trim() : null;
  const student_id = body.student_id ? String(body.student_id).trim() : null;
  if (!email || !full_name) return new Response(JSON.stringify({ error: "Full name and email are required" }), { status: 400, headers: cors });

  const redirectTo = "https://mmukul.github.io/student-portal/reset-password.html";
  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { full_name, phone, student_id, role: "student" },
  });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: cors });

  if (data.user) {
    await adminClient.from("profiles").upsert({ id: data.user.id, full_name, phone, student_id, role: "student", status: "active" }, { onConflict: "id" });
  }

  return new Response(JSON.stringify({ message: `Invitation sent to ${email}`, user_id: data.user?.id }), { status: 200, headers: cors });
});
