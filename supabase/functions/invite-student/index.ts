import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface ReqPayload {
  email?: string;
  full_name?: string;
  name?: string;
  phone?: string | null;
  student_id?: string | null;
  course_id?: string | null;
  batch_id?: string | null;
}

const INVITE_REDIRECT =
  "https://nextgendevsecops.in/student-portal/update-password.html";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default {
  fetch: withSupabase(
    { auth: ["publishable", "secret"] },
    async (req) => {
      try {
        if (req.method !== "POST") {
          return Response.json(
            { success: false, error: "Method not allowed." },
            { status: 405, headers: { Allow: "POST" } },
          );
        }

        const authorization = req.headers.get("Authorization") || "";
        const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
        if (!token) {
          return Response.json(
            { success: false, error: "Administrator authentication is required." },
            { status: 401 },
          );
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ||
          Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!supabaseUrl || !anonKey || !serviceRoleKey) {
          console.error("Invite function is missing one or more required Supabase secrets.");
          return Response.json(
            { success: false, error: "Server configuration error. Please contact the administrator." },
            { status: 500 },
          );
        }

        // Verify the caller's JWT and reuse the existing schema's MFA-aware admin gate.
        const caller = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { data: callerData, error: callerError } = await caller.auth.getUser(token);
        if (callerError || !callerData.user) {
          return Response.json(
            { success: false, error: "Administrator session is invalid or expired. Please sign in again." },
            { status: 401 },
          );
        }
        const { data: isAdmin, error: adminCheckError } = await caller.rpc("is_admin");
        if (adminCheckError) {
          console.error("Admin authorization RPC failed:", adminCheckError.message);
          return Response.json(
            { success: false, error: "Unable to verify administrator permissions. Please contact support." },
            { status: 503 },
          );
        }
        if (isAdmin !== true) {
          return Response.json(
            { success: false, error: "Access denied. An active administrator session with MFA is required." },
            { status: 403 },
          );
        }

        let body: ReqPayload;
        try {
          body = await req.json();
        } catch {
          return Response.json(
            { success: false, error: "Invalid JSON request body." },
            { status: 400 },
          );
        }

        const email = String(body.email || "").trim().toLowerCase();
        const fullName = String(body.full_name || body.name || "").trim().replace(/\s+/g, " ");
        const phone = body.phone ? String(body.phone).trim().slice(0, 40) : null;
        const studentId = body.student_id ? String(body.student_id).trim().slice(0, 100) : null;
        const courseId = body.course_id ? String(body.course_id).trim() : null;
        const batchId = body.batch_id ? String(body.batch_id).trim() : null;

        if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
          return Response.json(
            { success: false, error: "Enter a valid student email address." },
            { status: 400 },
          );
        }
        if (!fullName || fullName.length > 160) {
          return Response.json(
            { success: false, error: "Enter the student's full name (maximum 160 characters)." },
            { status: 400 },
          );
        }
        if (!courseId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(courseId)) {
          return Response.json(
            { success: false, error: "Select a valid course before inviting the student." },
            { status: 400 },
          );
        }
        if (batchId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(batchId)) {
          return Response.json(
            { success: false, error: "Select a valid batch or choose No batch." },
            { status: 400 },
          );
        }

        const admin = createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        // Paginate Auth users; checking only page 1 can miss existing accounts.
        let existingUser = null;
        for (let page = 1; page <= 20; page++) {
          const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
          if (error) {
            console.error("Auth user lookup failed:", error.message);
            return Response.json(
              { success: false, error: "Unable to check whether this student account already exists." },
              { status: 503 },
            );
          }
          existingUser = data.users.find((user) =>
            String(user.email || "").toLowerCase() === email
          ) || null;
          if (existingUser || data.users.length < 1000) break;
        }
        if (existingUser) {
          return Response.json(
            { success: false, error: `An account already exists for ${email}. Use the existing student account.` },
            { status: 409 },
          );
        }

        const { data: inviteData, error: inviteError } =
          await admin.auth.admin.inviteUserByEmail(email, {
            data: { full_name: fullName, name: fullName, phone, student_id: studentId },
            redirectTo: INVITE_REDIRECT,
          });
        if (inviteError || !inviteData?.user) {
          console.error("Supabase invitation failed:", inviteError?.message || "No user returned");
          return Response.json(
            { success: false, error: "Unable to send the student invitation. Check the Supabase Auth email configuration and try again." },
            { status: 502 },
          );
        }

        // The schema allows only active/inactive. New invitees remain inactive
        // until an administrator activates them; never write the invalid 'pending' value.
        const { error: profileError } = await admin.from("profiles").upsert(
          {
            id: inviteData.user.id,
            full_name: fullName,
            student_id: studentId,
            phone,
            role: "student",
            status: "active",
          },
          { onConflict: "id" },
        );
        if (profileError) {
          console.error("Student profile upsert failed:", profileError.message);
          return Response.json(
            {
              success: false,
              error: "The invitation was sent, but the student profile could not be saved. Contact support before sending another invitation.",
              user_id: inviteData.user.id,
            },
            { status: 500 },
          );
        }

        // Validate the selected course and optional batch before creating enrollment.
        const { data: course, error: courseError } = await admin
          .from("courses").select("id").eq("id", courseId).maybeSingle();
        if (courseError || !course) {
          console.error("Invitation course validation failed:", courseError?.message || "Course not found");
          return Response.json(
            { success: false, error: "The invitation was sent and profile created, but the selected course could not be verified. Assign the course from the Admin Portal." , user_id: inviteData.user.id },
            { status: 500 },
          );
        }
        if (batchId) {
          const { data: batch, error: batchError } = await admin
            .from("batches").select("id").eq("id", batchId).eq("course_id", courseId).maybeSingle();
          if (batchError || !batch) {
            console.error("Invitation batch validation failed:", batchError?.message || "Batch not found for course");
            return Response.json(
              { success: false, error: "The invitation was sent and profile created, but the selected batch does not belong to the selected course. Assign the course again from the Admin Portal.", user_id: inviteData.user.id },
              { status: 400 },
            );
          }
        }

        // Idempotently reuse an existing enrollment for this student/course.
        const { data: existingEnrollment, error: enrollmentLookupError } = await admin
          .from("enrollments").select("id").eq("student_id", inviteData.user.id)
          .eq("course_id", courseId).order("enrolled_at", { ascending: false }).limit(1).maybeSingle();
        if (enrollmentLookupError) {
          console.error("Enrollment lookup failed:", enrollmentLookupError.message);
          return Response.json(
            { success: false, error: "The invitation was sent, but course assignment could not be checked. Please assign the course from the Admin Portal.", user_id: inviteData.user.id },
            { status: 500 },
          );
        }
        let enrollmentId = existingEnrollment?.id || null;
        const enrollmentPayload = { student_id: inviteData.user.id, course_id: courseId, batch_id: batchId, status: "active" };
        const enrollmentResult = enrollmentId
          ? await admin.from("enrollments").update({ batch_id: batchId, status: "active" }).eq("id", enrollmentId).select("id").single()
          : await admin.from("enrollments").insert(enrollmentPayload).select("id").single();
        if (enrollmentResult.error || !enrollmentResult.data?.id) {
          console.error("Course enrollment failed:", enrollmentResult.error?.message || "No enrollment returned");
          return Response.json(
            { success: false, error: "The invitation was sent, but course assignment failed. Open the student record in Admin Portal and use Assign Course.", user_id: inviteData.user.id },
            { status: 500 },
          );
        }
        enrollmentId = enrollmentResult.data.id;

        return Response.json({
          success: true,
          message: `Invitation sent to ${email}; ${fullName} was enrolled in the selected course.`,
          email,
          full_name: fullName,
          user_id: inviteData.user.id,
          status: "active",
          course_id: courseId,
          batch_id: batchId,
          enrollment_id: enrollmentId,
        });
      } catch (error) {
        console.error("invite-student unexpected error:", error);
        return Response.json(
          { success: false, error: "The student invitation could not be completed. Please try again or contact support." },
          { status: 500 },
        );
      }
    },
  ),
};
