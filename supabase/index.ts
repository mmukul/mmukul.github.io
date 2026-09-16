import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), { status, headers:{...cors,"Content-Type":"application/json"} });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers:cors });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({error:"Missing authorization token."},401);

    const caller = await admin.auth.getUser(token);
    if (caller.error || !caller.data.user) return json({error:"Invalid administrator session."},401);
    const callerProfile = await admin.from("profiles").select("role,status").eq("id",caller.data.user.id).maybeSingle();
    if (callerProfile.error || callerProfile.data?.role !== "admin" || callerProfile.data?.status !== "active") return json({error:"Only an active administrator can invite students."},403);

    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const fullName = String(body.full_name || body.name || "").trim().replace(/\s+/g," ");
    const phone = body.phone ? String(body.phone).trim() : null;
    const studentId = body.student_id ? String(body.student_id).trim() : null;
    const courseId = body.course_id || null;
    const batchId = body.batch_id || null;
    if (!email || !fullName || !courseId) return json({error:"Full name, email and course are required."},400);

    const created = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName, name: fullName },
      redirectTo: `${supabaseUrl}/auth/v1/callback`
    });
    if (created.error) return json({error: created.error.message}, created.error.status || 400);
    const user = created.data.user;
    if (!user) return json({error:"Supabase did not return the invited user."},500);

    const profile = await admin.from("profiles").upsert({ id:user.id, full_name:fullName, phone, student_id:studentId, role:"student", status:"active" }, {onConflict:"id"});
    if (profile.error) return json({error:`Student profile could not be saved: ${profile.error.message}`},500);

    const existing = await admin.from("enrollments").select("id").eq("student_id",user.id).eq("course_id",courseId).order("enrolled_at",{ascending:false}).limit(1).maybeSingle();
    if (existing.error) return json({error:`Student account created but enrollment lookup failed: ${existing.error.message}`},500);
    let enrollmentError = null;
    if (existing.data?.id) {
      const updated = await admin.from("enrollments").update({batch_id:batchId,status:"active"}).eq("id",existing.data.id);
      enrollmentError = updated.error;
    } else {
      const inserted = await admin.from("enrollments").insert({student_id:user.id,course_id:courseId,batch_id:batchId,status:"active"});
      enrollmentError = inserted.error;
    }
    if (enrollmentError) return json({error:`Student account created but enrollment could not be saved: ${enrollmentError.message}`},500);

    return json({success:true,message:`Invitation sent to ${email}.`});
  } catch (e) {
    console.error(e);
    return json({error:e instanceof Error ? e.message : "Unable to invite student."},500);
  }
});
