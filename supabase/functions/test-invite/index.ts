import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

console.info("test-invite function loaded");

export default {
  fetch: withSupabase(
    { auth: ["publishable", "secret"] },
    async (req, ctx) => {
      console.info("test-invite handler reached");

      return Response.json({
        success: true,
        message: "Edge Function is working",
        method: req.method
      });
    }
  )
};
