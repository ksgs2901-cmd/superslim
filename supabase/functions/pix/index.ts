import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ── Preços server-side (em centavos p/ Blackcat) ──
const PIX_PRODUCTS: Record<string, { priceCents: number; name: string }> = {
  seguro:  { priceCents: 1948, name: "Seguro Prestamista - SuperSim" },
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
  seguro_ds: { priceCents: 974,  name: "Seguro Prestamista - SuperSim" },
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

const BLACKCAT_URL = "https://api.blackcatoficial.com/api";

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

    // ── Valida produto ──
    const product = PIX_PRODUCTS[upKey];
    if (!product) {
      return new Response(JSON.stringify({ success: false, error: "Produto inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Chave secreta da Blackcat (variável de ambiente) ──
    const BLACKCAT_SECRET = Deno.env.get("BLACKCAT_SECRET_KEY");
    if (!BLACKCAT_SECRET) {
      console.error("BLACKCAT_SECRET_KEY not configured");
      return new Response(JSON.stringify({ success: false, error: "Server config error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Limpa CPF (só dígitos) ──
    const cpfClean = (cpf || "").replace(/\D/g, "");

    // ── Cria cobrança na Blackcat ──
    // ── Telefone: apenas dígitos, com DDI 55 ──
    let phoneClean = (phone || "").replace(/\D/g, "");
    if (phoneClean && phoneClean.length <= 11 && !phoneClean.startsWith("55")) {
      phoneClean = "55" + phoneClean;
    }

    const blackcatPayload = {
      amount: product.priceCents,
      paymentMethod: "pix",
      customer: {
        name: nome || "Cliente",
        email: email || `${cpfClean || "cliente"}@email.com`,
        phone: phoneClean || "5500000000000",
        document: {
          number: cpfClean,
          type: cpfClean.length > 11 ? "cnpj" : "cpf",
        },
      },
      items: [
        {
          title: product.name,
          quantity: 1,
          unitPrice: product.priceCents,
          tangible: false,
        },
      ],
      pix: {
        expiresInDays: 1,
      },
    };

    console.log(`[PIX] Creating sale for upKey=${upKey}, amount=${product.priceCents}`);

    const bcResponse = await fetch(`${BLACKCAT_URL}/sales/create-sale`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": BLACKCAT_SECRET,
      },
      body: JSON.stringify(blackcatPayload),
    });

    const bcData = await bcResponse.json();
    console.log(`[PIX] Blackcat response status=${bcResponse.status}`, JSON.stringify(bcData));

    if (!bcResponse.ok) {
      return new Response(JSON.stringify({
        success: false,
        error: bcData.message || "Erro ao criar cobrança",
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Extrai dados do PIX ──
    // Blackcat retorna: { success: true, data: { transactionId, paymentData: { qrCode, copyPaste, qrCodeBase64 } } }
    const txnId = bcData.data?.transactionId || bcData.transactionId || bcData.id;
    const qrcode = bcData.data?.paymentData?.copyPaste || bcData.data?.paymentData?.qrCode || bcData.data?.pix?.qrCode || "";
    const amountReais = product.priceCents / 100;

    if (!txnId || !qrcode) {
      console.error("[PIX] Missing txnId or qrcode in Blackcat response:", JSON.stringify(bcData));
      return new Response(JSON.stringify({
        success: false,
        error: "Resposta incompleta do gateway",
        debug: { hasTxn: !!txnId, hasQr: !!qrcode },
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
