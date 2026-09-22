import "jsr:@supabase/functions-js/edge-runtime.d.ts";

console.info("edge-test loaded");

Deno.serve(async (req) => {
  console.info("edge-test handler reached");

  return new Response(
    JSON.stringify({
      success: true,
      message: "Edge Function runtime is working",
      method: req.method
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
});
