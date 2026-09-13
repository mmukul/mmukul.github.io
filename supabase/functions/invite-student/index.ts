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
  const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";
  if (!anonKey) return new Response(JSON.stringify({ error: "Supabase publishable/anon key is not configured for the Edge Function" }), { status: 500, headers: cors });
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
  const course_id = body.course_id ? String(body.course_id).trim() : null;
  const batch_id = body.batch_id ? String(body.batch_id).trim() : null;
  if (!email || !full_name || !course_id) return new Response(JSON.stringify({ error: "Full name, email and course are required" }), { status: 400, headers: cors });

  const { data: course } = await adminClient.from("courses").select("id,name").eq("id", course_id).maybeSingle();
  if (!course) return new Response(JSON.stringify({ error: "Selected course was not found" }), { status: 400, headers: cors });

  if (batch_id) {
    const { data: batch } = await adminClient.from("batches").select("id,course_id").eq("id", batch_id).maybeSingle();
    if (!batch) return new Response(JSON.stringify({ error: "Selected batch was not found" }), { status: 400, headers: cors });
    if (batch.course_id !== course_id) return new Response(JSON.stringify({ error: "Selected batch does not belong to the selected course" }), { status: 400, headers: cors });
  }

  const redirectTo = "https://mmukul.github.io/student-portal/reset-password.html";
  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { full_name, phone, student_id, role: "student" },
  });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: cors });

  if (data.user) {
    const { error: profileError } = await adminClient.from("profiles").upsert({ id: data.user.id, full_name, phone, student_id, role: "student", status: "active" }, { onConflict: "id" });
    if (profileError) return new Response(JSON.stringify({ error: `Student created but profile setup failed: ${profileError.message}` }), { status: 500, headers: cors });

    const { error: enrollmentError } = await adminClient.from("enrollments").upsert({
      student_id: data.user.id, course_id, batch_id, status: "active"
    }, { onConflict: "student_id,course_id,batch_id" });
    if (enrollmentError) return new Response(JSON.stringify({ error: `Student invited but enrollment failed: ${enrollmentError.message}` }), { status: 500, headers: cors });
  }

  return new Response(JSON.stringify({ message: `Invitation sent to ${email} and enrolled in ${course.name}`, user_id: data.user?.id, course_id, batch_id }), { status: 200, headers: cors });
});
