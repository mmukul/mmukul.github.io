import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface DeletePayload {
  student_id?: string;
}

console.info("delete-student function started");

export default {
  fetch: withSupabase(
    { auth: ["publishable", "secret"] },
    async (req) => {
      try {
        if (req.method !== "POST") {
          return Response.json(
            { success: false, error: "Method not allowed" },
            { status: 405 }
          );
        }

        const body: DeletePayload = await req.json();
        const studentId = String(body.student_id || "").trim();

        if (!studentId) {
          return Response.json(
            { success: false, error: "Student ID is required." },
            { status: 400 }
          );
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        const anonKey =
          Deno.env.get("SUPABASE_ANON_KEY") ||
          Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

        if (!supabaseUrl || !serviceRoleKey || !anonKey) {
          console.error("Required Supabase server configuration is missing.");
          return Response.json(
            {
              success: false,
              error: "Server configuration is incomplete."
            },
            { status: 500 }
          );
        }

        /*
         * Verify the caller's Supabase session using the Authorization header.
         * Never trust a student_id supplied by the browser as proof of admin access.
         */
        const authorization = req.headers.get("Authorization");
        if (!authorization) {
          return Response.json(
            { success: false, error: "Authentication required." },
            { status: 401 }
          );
        }

        const userClient = createClient(supabaseUrl, anonKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          },
          global: {
            headers: {
              Authorization: authorization
            }
          }
        });

        const { data: callerData, error: callerError } =
          await userClient.auth.getUser();

        if (callerError || !callerData.user) {
          console.error("Caller authentication failed:", callerError);
          return Response.json(
            { success: false, error: "Authentication required." },
            { status: 401 }
          );
        }

        const admin = createClient(supabaseUrl, serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        });

        /* Verify the caller is an active administrator. */
        const { data: adminProfile, error: adminError } = await admin
          .from("profiles")
          .select("id, role, status")
          .eq("id", callerData.user.id)
          .maybeSingle();

        if (
          adminError ||
          !adminProfile ||
          adminProfile.role !== "admin" ||
          adminProfile.status !== "active"
        ) {
          console.error("Admin authorization failed:", adminError);
          return Response.json(
            { success: false, error: "Administrator access required." },
            { status: 403 }
          );
        }

        /* Prevent accidental deletion of an administrator account. */
        const { data: targetProfile, error: targetError } = await admin
          .from("profiles")
          .select("id, full_name, role, status")
          .eq("id", studentId)
          .maybeSingle();

        if (targetError) {
          return Response.json(
            {
              success: false,
              error: `Unable to find student: ${targetError.message}`
            },
            { status: 500 }
          );
        }

        if (!targetProfile) {
          return Response.json(
            { success: false, error: "Student profile was not found." },
            { status: 404 }
          );
        }

        if (targetProfile.role !== "student") {
          return Response.json(
            {
              success: false,
              error: "The selected account is not a student account."
            },
            { status: 400 }
          );
        }

        console.info(
          `Deleting student ${studentId} (${targetProfile.full_name || "Unnamed Student"})`
        );

        /*
         * profiles.id references auth.users.id ON DELETE CASCADE in the
         * production LMS schema. Student-related rows that reference the
         * profile also use ON DELETE CASCADE, so deleting the Auth user is
         * the authoritative account deletion operation.
         */
        const { error: deleteError } =
          await admin.auth.admin.deleteUser(studentId);

        if (deleteError) {
          console.error("Auth user deletion failed:", deleteError);
          return Response.json(
            {
              success: false,
              error: `Unable to delete student: ${deleteError.message}`
            },
            { status: 500 }
          );
        }

        return Response.json({
          success: true,
          message: `Student ${targetProfile.full_name || "account"} was deleted successfully.`,
          student_id: studentId
        });
      } catch (error) {
        console.error("delete-student unexpected error:", error);
        return Response.json(
          {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Unexpected server error."
          },
          { status: 500 }
        );
      }
    }
  )
};
