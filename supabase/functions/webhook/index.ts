import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ── Preços server-side (espelho do pix/index.ts) ──
const PIX_PRODUCTS: Record<string, { priceCents: number; name: string }> = {
  seguro:  { priceCents: 1290, name: "Seguro Prestamista - SuperSim" },
  up1:     { priceCents: 2482, name: "IOF - Imposto sobre Operações Financeiras" },
  up2:     { priceCents: 2391, name: "Taxa de Verificação de IOF" },
  up3:     { priceCents: 1868, name: "Seguro Prestamista - Tarifa de Cadastro" },
  up4:     { priceCents: 1720, name: "TENF - Taxa de Emissão da Nota Fiscal" },
  up5:     { priceCents: 1700, name: "Ativar Conta" },
  up6:     { priceCents: 1702, name: "Taxa de Registro do Contrato" },
  up7:     { priceCents: 1406, name: "Taxa - Limite Adicional de R$20.000" },
  up8:     { priceCents: 1406, name: "Taxa de Processamento" },
  up9:     { priceCents: 1199, name: "Aplicativo SuperSim" },
  up10:    { priceCents: 1692, name: "TAC - Taxa de Abertura de Crédito" },
  up11:    { priceCents: 1953, name: "Taxa de Consultoria Financeira" },
  up12:    { priceCents: 3192, name: "Taxa de Processamento Administrativo" },
  // ── DOWNSELL (50% OFF) ──
  seguro_ds: { priceCents: 645,  name: "Seguro Prestamista - SuperSim" },
  up1_ds:    { priceCents: 1241, name: "IOF - Imposto sobre Operações Financeiras" },
  up2_ds:    { priceCents: 1196, name: "Taxa de Verificação de IOF" },
  up3_ds:    { priceCents: 934,  name: "Seguro Prestamista - Tarifa de Cadastro" },
  up4_ds:    { priceCents: 860,  name: "TENF - Taxa de Emissão da Nota Fiscal" },
  up5_ds:    { priceCents: 850,  name: "Ativar Conta" },
  up6_ds:    { priceCents: 850,  name: "Taxa de Registro do Contrato" },
  up7_ds:    { priceCents: 703,  name: "Taxa - Limite Adicional de R$20.000" },
  up8_ds:    { priceCents: 703,  name: "Taxa de Processamento" },
  up9_ds:    { priceCents: 600,  name: "Aplicativo SuperSim" },
  up10_ds:   { priceCents: 846,  name: "TAC - Taxa de Abertura de Crédito" },
  up11_ds:   { priceCents: 977,  name: "Taxa de Consultoria Financeira" },
  up12_ds:   { priceCents: 1596, name: "Taxa de Processamento Administrativo" },
};

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

    // ── Registra pedido na Utmify quando pagamento é confirmado ──
    const isPaid = event === "transaction.paid" ||
                   event === "sale.paid" ||
                   event === "payment.confirmed" ||
                   status === "paid" ||
                   status === "PAID";

    if (isPaid) {
      console.log(`[WEBHOOK] Payment confirmed for txn=${txnId}. Registering on Utmify...`);

      // Extrair metadata (UTMs) que foram enviados na criação da cobrança
      const metadata = body.metadata || body.data?.metadata || {};
      const upKey = metadata.upKey || "seguro";
      const product = PIX_PRODUCTS[upKey] || PIX_PRODUCTS["seguro"];
      const amountReais = product.priceCents / 100;

      // Montar trackingParameters da Utmify com as UTMs da metadata
      const trackingParameters = {
        src: metadata.src || null,
        sck: metadata.sck || null,
        utm_source: metadata.utm_source || null,
        utm_medium: metadata.utm_medium || null,
        utm_campaign: metadata.utm_campaign || null,
        utm_content: metadata.utm_content || null,
        utm_term: metadata.utm_term || null,
      };

      // Registrar o pedido na Utmify
      const UTMIFY_API_TOKEN = Deno.env.get("UTMIFY_API_TOKEN");
      if (UTMIFY_API_TOKEN) {
        try {
          const now = new Date();
          const utmifyDate = now.toISOString().replace("T", " ").substring(0, 19);

          const utmifyPayload = {
            orderId: txnId,
            platform: "CustomPix",
            paymentMethod: "pix",
            status: "paid",
            createdAt: utmifyDate,
            approvedDate: utmifyDate,
            customer: {
              name: metadata.customerName || "Cliente",
              email: metadata.customerEmail || "",
              phone: metadata.customerPhone || "",
              document: metadata.customerDocument || "",
            },
            products: [
              {
                id: upKey,
                name: product.name,
                quantity: 1,
                priceInCents: product.priceCents,
              },
            ],
            trackingParameters,
            commission: {
              totalPriceInCents: product.priceCents,
              gatewayFeeInCents: 0,
              userCommissionInCents: product.priceCents,
            },
            isTest: false,
          };

          console.log(`[WEBHOOK] Sending to Utmify:`, JSON.stringify(utmifyPayload));

          const utmifyRes = await fetch("https://api.utmify.com.br/api-credentials/orders", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-token": UTMIFY_API_TOKEN,
            },
            body: JSON.stringify(utmifyPayload),
          });

          const utmifyResult = await utmifyRes.json();
          console.log(`[WEBHOOK] Utmify response status=${utmifyRes.status}:`, JSON.stringify(utmifyResult));
        } catch (utmifyErr) {
          // Não bloqueia o webhook por falha na Utmify
          console.error("[WEBHOOK] Utmify registration failed:", utmifyErr);
        }
      } else {
        console.warn("[WEBHOOK] UTMIFY_API_TOKEN not configured — skipping Utmify registration");
      }
    }

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
