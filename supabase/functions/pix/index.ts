import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ── Produtos/ofertas cadastrados na InvictusPay (product_hash + offer_hash) ──
const PIX_PRODUCTS: Record<string, { priceCents: number; name: string; productHash: string; offerHash: string }> = {
  seguro:    { priceCents: 1948, name: "Seguro Prestamista - SuperSim",              productHash: "giwkhiwref", offerHash: "63fhm" },
  up1:       { priceCents: 2482, name: "IOF - Imposto sobre Operações Financeiras",   productHash: "r9afv8sztr", offerHash: "pfnwd" },
  up2:       { priceCents: 2391, name: "Taxa de Verificação de IOF",                  productHash: "yapvcq8gwc", offerHash: "hic4z" },
  up3:       { priceCents: 1868, name: "Seguro Prestamista - Tarifa de Cadastro",     productHash: "hmigi2vct6", offerHash: "gdoeq" },
  up4:       { priceCents: 1720, name: "TENF - Taxa de Emissão da Nota Fiscal",       productHash: "fyvpnxouab", offerHash: "yf81c" },
  up5:       { priceCents: 1700, name: "Ativar Conta",                               productHash: "rppl6fbvln", offerHash: "qn5hi" },
  up6:       { priceCents: 1702, name: "Taxa de Registro do Contrato",               productHash: "j0nj2urjk2", offerHash: "x3quy" },
  up7:       { priceCents: 1406, name: "Taxa - Limite Adicional de R$20.000",        productHash: "aq1y1sbu6x", offerHash: "giw0z" },
  up8:       { priceCents: 1406, name: "Taxa de Processamento",                      productHash: "xgpnk4hlj7", offerHash: "xvcpf" },
  up9:       { priceCents: 1199, name: "Aplicativo SuperSim",                        productHash: "kwaxxp1ijz", offerHash: "7ccmc" },
  up10:      { priceCents: 1692, name: "TAC - Taxa de Abertura de Crédito",          productHash: "65uqv8d137", offerHash: "3d9jy" },
  up11:      { priceCents: 1953, name: "Taxa de Consultoria Financeira",             productHash: "qzcbj0ovvy", offerHash: "gx3zv" },
  up12:      { priceCents: 3192, name: "Taxa de Processamento Administrativo",       productHash: "g7llhbwveo", offerHash: "38isd" },
  // ── DOWNSELL (50% OFF) ──
  seguro_ds: { priceCents: 645,  name: "Seguro Prestamista - SuperSim",              productHash: "ydcktrxv0v", offerHash: "v2rpu" },
  up1_ds:    { priceCents: 1241, name: "IOF - Imposto sobre Operações Financeiras",   productHash: "cijrbnszjf", offerHash: "eknp2" },
  up2_ds:    { priceCents: 1196, name: "Taxa de Verificação de IOF",                  productHash: "chhbqnt5lb", offerHash: "kqhgo" },
  up3_ds:    { priceCents: 934,  name: "Seguro Prestamista - Tarifa de Cadastro",     productHash: "aezadrexwr", offerHash: "s7lp9" },
  up4_ds:    { priceCents: 860,  name: "TENF - Taxa de Emissão da Nota Fiscal",       productHash: "ttpokudoxz", offerHash: "0tkr2" },
  up5_ds:    { priceCents: 850,  name: "Ativar Conta",                               productHash: "rdmjwtcnoh", offerHash: "kx1vd" },
  up6_ds:    { priceCents: 850,  name: "Taxa de Registro do Contrato",               productHash: "bm9qwtskq8", offerHash: "rb64g" },
  up7_ds:    { priceCents: 703,  name: "Taxa - Limite Adicional de R$20.000",        productHash: "wxi37bkeof", offerHash: "thsla" },
  up8_ds:    { priceCents: 703,  name: "Taxa de Processamento",                      productHash: "faw1qlhsav", offerHash: "1pqjs" },
  up9_ds:    { priceCents: 600,  name: "Aplicativo SuperSim",                        productHash: "wla8o7oxkk", offerHash: "pf2pm" },
  up10_ds:   { priceCents: 846,  name: "TAC - Taxa de Abertura de Crédito",          productHash: "yhiekzqqy3", offerHash: "0u7j7" },
  up11_ds:   { priceCents: 977,  name: "Taxa de Consultoria Financeira",             productHash: "uv82qr9kc9", offerHash: "ctetc" },
  up12_ds:   { priceCents: 1596, name: "Taxa de Processamento Administrativo",       productHash: "vsouxvjrpn", offerHash: "ocrtj" },
};

const INVICTUS_URL = "https://api.invictuspay.app.br/api/public/v1";
const WEBHOOK_URL = "https://ziznxwaehnifcinosenv.supabase.co/functions/v1/webhook";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

Deno.serve(async (req: Request) => {
  // ── CORS preflight ──
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { upKey, nome, cpf, email, phone } = body;

    // ── UTMs de rastreamento (enviados pelo frontend via getUtms()) ──
    const utms = body.utms || {};
    const trackingParams = {
      src: utms.src || null,
      sck: utms.sck || null,
      utm_source: utms.utm_source || null,
      utm_medium: utms.utm_medium || null,
      utm_campaign: utms.utm_campaign || null,
      utm_content: utms.utm_content || null,
      utm_term: utms.utm_term || null,
    };

    // ── Valida produto ──
    const product = PIX_PRODUCTS[upKey];
    if (!product) {
      return new Response(JSON.stringify({ success: false, error: "Produto inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Token da InvictusPay (variável de ambiente) ──
    const INVICTUS_API_TOKEN = Deno.env.get("INVICTUS_API_TOKEN");
    if (!INVICTUS_API_TOKEN) {
      console.error("INVICTUS_API_TOKEN not configured");
      return new Response(JSON.stringify({ success: false, error: "Server config error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Limpa CPF (só dígitos) ──
    const cpfClean = (cpf || "").replace(/\D/g, "");
    // ── Telefone: apenas dígitos, sem DDI (formato esperado pela InvictusPay: DDD+número) ──
    const phoneClean = (phone || "").replace(/\D/g, "");

    const invictusPayload = {
      amount: product.priceCents,
      offer_hash: product.offerHash,
      payment_method: "pix",
      customer: {
        name: nome || "Cliente",
        email: email || `${cpfClean || "cliente"}@email.com`,
        phone_number: phoneClean || "11999999999",
        document: cpfClean,
      },
      cart: [
        {
          product_hash: product.productHash,
          title: product.name,
          price: product.priceCents,
          quantity: 1,
          operation_type: 1,
          tangible: false,
        },
      ],
      expire_in_days: 1,
      transaction_origin: "api",
      // UTMs de rastreamento no formato esperado pela InvictusPay
      tracking: {
        src: trackingParams.src || "",
        sck: trackingParams.sck || "",
        utm_source: trackingParams.utm_source || "",
        utm_medium: trackingParams.utm_medium || "",
        utm_campaign: trackingParams.utm_campaign || "",
        utm_content: trackingParams.utm_content || "",
        utm_term: trackingParams.utm_term || "",
      },
      // Postback por transação — a InvictusPay chama essa URL quando o status mudar
      postback_url: WEBHOOK_URL,
    };

    console.log(`[PIX] Creating sale for upKey=${upKey}, amount=${product.priceCents}, utms=${JSON.stringify(trackingParams)}`);

    const invRes = await fetch(`${INVICTUS_URL}/transactions?api_token=${INVICTUS_API_TOKEN}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(invictusPayload),
    });

    const invData = await invRes.json();
    console.log(`[PIX] InvictusPay response status=${invRes.status}`, JSON.stringify(invData));

    if (!invRes.ok) {
      return new Response(JSON.stringify({
        success: false,
        error: invData.message || "Erro ao criar cobrança",
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Extrai dados do PIX ──
    const txnId = invData.hash;
    const qrcode = invData.pix?.pix_qr_code || "";
    const amountReais = product.priceCents / 100;

    if (!txnId || !qrcode) {
      console.error("[PIX] Missing txnId or qrcode in InvictusPay response:", JSON.stringify(invData));
      return new Response(JSON.stringify({
        success: false,
        error: "Resposta incompleta do gateway",
        debug: { hasTxn: !!txnId, hasQr: !!qrcode },
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Persiste a transação c/ as UTMs capturadas agora — fonte confiável pro webhook depois,
    // já que o postback da InvictusPay não devolve UTM/metadata nenhum ──
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/transactions?on_conflict=txn_id`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Prefer": "resolution=merge-duplicates",
          },
          body: JSON.stringify({
            txn_id: txnId,
            up_key: upKey,
            amount: product.priceCents,
            status: "PENDING",
            qr_code: qrcode,
            customer_name: nome || "",
            customer_cpf: cpfClean,
            customer_email: email || "",
            customer_phone: phoneClean,
            metadata: trackingParams,
          }),
        });
      } catch (dbErr) {
        console.error("[PIX] Failed to persist transaction:", dbErr);
      }
    }

    // ── Retorna para o frontend (mesmo contrato que o antigo) ──
    return new Response(JSON.stringify({
      success: true,
      txnId: txnId,
      qrcode: qrcode,
      amount: amountReais,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[PIX] Unexpected error:", err);
    return new Response(JSON.stringify({ success: false, error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
