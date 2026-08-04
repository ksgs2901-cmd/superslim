import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const INVICTUS_URL = "https://api.invictuspay.app.br/api/public/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

Deno.serve(async (req: Request) => {
  // ── CORS preflight ──
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ paid: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const txnId = url.searchParams.get("id");

    if (!txnId) {
      return new Response(JSON.stringify({ paid: false, error: "Missing id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const INVICTUS_API_TOKEN = Deno.env.get("INVICTUS_API_TOKEN");
    if (!INVICTUS_API_TOKEN) {
      console.error("INVICTUS_API_TOKEN not configured");
      return new Response(JSON.stringify({ paid: false, error: "Server config error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Consulta status na InvictusPay ──
    const invRes = await fetch(`${INVICTUS_URL}/transactions/${txnId}?api_token=${INVICTUS_API_TOKEN}`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    const invData = await invRes.json();

    if (!invRes.ok) {
      console.error(`[STATUS] InvictusPay error for txn=${txnId}:`, JSON.stringify(invData));
      return new Response(JSON.stringify({ paid: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Verifica se está pago ──
    const status = (invData.payment_status || invData.status || "").toLowerCase();
    const isPaid = status === "paid";

    console.log(`[STATUS] txn=${txnId} status=${status} paid=${isPaid}`);

    return new Response(JSON.stringify({ paid: isPaid }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[STATUS] Unexpected error:", err);
    return new Response(JSON.stringify({ paid: false }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
