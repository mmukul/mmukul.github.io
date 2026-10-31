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

        // Validate course and batch BEFORE creating an Auth user or sending email.
        const { data: course, error: courseError } = await admin
          .from("courses").select("id").eq("id", courseId).maybeSingle();
        if (courseError) {
          console.error("Invitation course lookup failed:", courseError.message);
          return Response.json(
            { success: false, code: "COURSE_LOOKUP_FAILED", error: "Unable to verify the selected course. Please retry or contact support." },
            { status: 503 },
          );
        }
        if (!course) {
          return Response.json(
            { success: false, code: "COURSE_NOT_FOUND", field: "course_id", error: "The selected course no longer exists. Refresh the course list and try again." },
            { status: 400 },
          );
        }
        if (batchId) {
          const { data: batch, error: batchError } = await admin
            .from("batches").select("id").eq("id", batchId).eq("course_id", courseId).maybeSingle();
          if (batchError) {
            console.error("Invitation batch lookup failed:", batchError.message);
            return Response.json(
              { success: false, code: "BATCH_LOOKUP_FAILED", error: "Unable to verify the selected batch. Please retry." },
              { status: 503 },
            );
          }
          if (!batch) {
            return Response.json(
              { success: false, code: "BATCH_COURSE_MISMATCH", field: "batch_id", error: "The selected batch does not belong to this course. Refresh the batch list and try again." },
              { status: 400 },
            );
          }
        }

        // Paginate Auth users. Reuse only an unconfirmed account left behind by
        // a previous failed invitation attempt; never silently take over a confirmed account.
        let existingUser = null;
        for (let page = 1; page <= 20; page++) {
          const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
          if (error) {
            console.error("Auth user lookup failed:", error.message);
            return Response.json(
              { success: false, code: "AUTH_LOOKUP_FAILED", error: "Unable to check whether this student account already exists." },
              { status: 503 },
            );
          }
          existingUser = data.users.find((user) =>
            String(user.email || "").toLowerCase() === email
          ) || null;
          if (existingUser || data.users.length < 1000) break;
        }

        if (existingUser?.email_confirmed_at) {
          return Response.json(
            { success: false, code: "ACCOUNT_EXISTS", error: `An active or previously registered account already exists for ${email}. Use Admin Portal → Assign Course for this student.` },
            { status: 409 },
          );
        }

        let authUser = existingUser;
        let invitationSent = false;
        let invitationPending = false;

        if (!authUser) {
          const { data: inviteData, error: inviteError } =
            await admin.auth.admin.inviteUserByEmail(email, {
              data: { full_name: fullName, name: fullName, phone, student_id: studentId },
              redirectTo: INVITE_REDIRECT,
            });

          authUser = inviteData?.user || null;
          if (inviteError || !authUser) {
            // Supabase may create the Auth user before its SMTP delivery fails.
            // Re-read Auth users so the profile/enrollment can still be completed
            // for that newly-created, unconfirmed account.
            console.error("Supabase invitation delivery failed:", inviteError?.message || "No user returned");
            for (let page = 1; page <= 20 && !authUser; page++) {
              const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
              if (error) {
                console.error("Auth recovery lookup failed:", error.message);
                break;
              }
              authUser = data.users.find((user) =>
                String(user.email || "").toLowerCase() === email
              ) || null;
              if (data.users.length < 1000) break;
            }
            if (!authUser || authUser.email_confirmed_at) {
              return Response.json(
                { success: false, code: "INVITE_EMAIL_FAILED", invitation_sent: false, error: "Supabase could not send the invitation email. Check Authentication SMTP settings and Resend delivery logs; no course assignment was confirmed." },
                { status: 502 },
              );
            }
            invitationPending = true;
          } else {
            invitationSent = true;
          }
        } else {
          // A prior attempt created an unconfirmed Auth user but did not finish.
          // Complete profile/enrollment idempotently; do not claim a fresh email was sent.
          invitationPending = true;
        }

        const authUserId = authUser.id;

        // Upsert profile. The supplied schema permits only active/inactive.
        const { error: profileError } = await admin.from("profiles").upsert(
          {
            id: authUserId,
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
            { success: false, code: "PROFILE_SAVE_FAILED", invitation_sent: invitationSent, user_id: authUserId, error: "The Auth account exists, but the student profile could not be saved. Do not invite again; resolve the profile error first." },
            { status: 500 },
          );
        }

        // Idempotently update the newest enrollment for this student/course.
        const { data: existingEnrollment, error: enrollmentLookupError } = await admin
          .from("enrollments").select("id").eq("student_id", authUserId)
          .eq("course_id", courseId).order("enrolled_at", { ascending: false }).limit(1).maybeSingle();
        if (enrollmentLookupError) {
          console.error("Enrollment lookup failed:", enrollmentLookupError.message);
          return Response.json(
            { success: false, code: "ENROLLMENT_LOOKUP_FAILED", invitation_sent: invitationSent, user_id: authUserId, error: "Student profile exists, but course assignment could not be checked. Use Admin Portal → Assign Course after resolving the database error." },
            { status: 500 },
          );
        }
        const enrollmentPayload = { student_id: authUserId, course_id: courseId, batch_id: batchId, status: "active" };
        const enrollmentResult = existingEnrollment?.id
          ? await admin.from("enrollments").update({ batch_id: batchId, status: "active" }).eq("id", existingEnrollment.id).select("id").single()
          : await admin.from("enrollments").insert(enrollmentPayload).select("id").single();
        if (enrollmentResult.error || !enrollmentResult.data?.id) {
          console.error("Course enrollment failed:", enrollmentResult.error?.message || "No enrollment returned");
          return Response.json(
            { success: false, code: "ENROLLMENT_SAVE_FAILED", invitation_sent: invitationSent, user_id: authUserId, error: "Student account exists, but course assignment failed. Use Admin Portal → Assign Course after resolving the database error." },
            { status: 500 },
          );
        }
        const enrollmentId = enrollmentResult.data.id;

        return Response.json({
          success: true,
          message: invitationSent
            ? `Invitation sent to ${email}; ${fullName} was enrolled in the selected course.`
            : `Course assigned to ${fullName}. The Auth account already exists from a previous attempt, but invitation email delivery is still pending. Resolve SMTP and resend the invitation.`,
          invitation_sent: invitationSent,
          invitation_pending: invitationPending,
          email,
          full_name: fullName,
          user_id: authUserId,
          status: "active",
          course_id: courseId,
          batch_id: batchId,
          enrollment_id: enrollmentId,
        });
      } catch (error) {
        console.error("invite-student unexpected error:", error);
        return Response.json(
          { success: false, code: "INVITE_UNEXPECTED_ERROR", error: "The student invitation could not be completed. Check the Edge Function logs for the corresponding request and contact support." },
          { status: 500 },
        );
      }
    },
  ),
};
