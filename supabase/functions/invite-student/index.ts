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

  // If the Auth user already exists, do not fail with "User already registered".
  // Reuse the account, make sure it is an active student, and enroll it.
  let user = null;
  let invited = false;
  const { data: userPage, error: listError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) return new Response(JSON.stringify({ error: `Unable to check existing student account: ${listError.message}` }), { status: 500, headers: cors });
  user = (userPage?.users || []).find(u => String(u.email || '').toLowerCase() === email) || null;

  if (!user) {
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { full_name, phone, student_id, role: "student" },
    });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: cors });
    user = data.user;
    invited = true;
  } else {
    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
      user_metadata: { ...(user.user_metadata || {}), full_name, phone, student_id, role: "student" }
    });
    if (updateError) return new Response(JSON.stringify({ error: `Existing account found but could not update student details: ${updateError.message}` }), { status: 500, headers: cors });
  }

  if (!user?.id) return new Response(JSON.stringify({ error: "Student Auth account could not be created or located" }), { status: 500, headers: cors });

  const { error: profileError } = await adminClient.from("profiles").upsert({ id: user.id, full_name, phone, student_id, role: "student", status: "active" }, { onConflict: "id" });
  if (profileError) return new Response(JSON.stringify({ error: `Student account found but profile setup failed: ${profileError.message}` }), { status: 500, headers: cors });

  // Keep enrollment upsert idempotent. PostgreSQL treats NULL batch IDs as distinct,
  // so the same course without a batch can technically appear more than once.
  // Avoid duplicates explicitly for the common no-batch case.
  let enrollmentError = null;
  if (batch_id) {
    const result = await adminClient.from("enrollments").upsert({
      student_id: user.id, course_id, batch_id, status: "active"
    }, { onConflict: "student_id,course_id,batch_id" });
    enrollmentError = result.error;
  } else {
    const { data: existingEnrollment } = await adminClient.from("enrollments")
      .select("id")
      .eq("student_id", user.id)
      .eq("course_id", course_id)
      .is("batch_id", null)
      .maybeSingle();
    if (existingEnrollment?.id) {
      const result = await adminClient.from("enrollments").update({ status: "active" }).eq("id", existingEnrollment.id);
      enrollmentError = result.error;
    } else {
      const result = await adminClient.from("enrollments").insert({ student_id: user.id, course_id, batch_id: null, status: "active" });
      enrollmentError = result.error;
    }
  }
  if (enrollmentError) return new Response(JSON.stringify({ error: `${invited ? "Student invited" : "Existing student enrolled"} but enrollment failed: ${enrollmentError.message}` }), { status: 500, headers: cors });

  const message = invited
    ? `Invitation sent to ${email} and enrolled in ${course.name}`
    : `${email} already has an account. Student access and enrollment were updated for ${course.name}.`;
  return new Response(JSON.stringify({ message, user_id: user.id, course_id, batch_id, invited }), { status: 200, headers: cors });
});
