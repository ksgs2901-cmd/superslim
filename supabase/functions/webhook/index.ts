import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-API-Key, x-webhook-secret",
};

Deno.serve(async (req: Request) => {
  // ── CORS preflight ──
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const event = body.event || body.type || "unknown";
    const txnId = body.transactionId || body.data?.transactionId || body.id || "unknown";
    const status = body.status || body.data?.status || "unknown";

    console.log(`[WEBHOOK] event=${event} txn=${txnId} status=${status}`);
    console.log(`[WEBHOOK] Full payload:`, JSON.stringify(body));

    // Por enquanto, apenas loga o webhook.
    // Quando o banco de dados for configurado, aqui fará UPDATE na tabela transactions.
    // Ex:
    // if (event === "transaction.paid") {
    //   await supabase.from("transactions").update({ status: "PAID", paid_at: new Date() }).eq("txn_id", txnId);
    // }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[WEBHOOK] Error:", err);
    return new Response(JSON.stringify({ received: false, error: "Parse error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
