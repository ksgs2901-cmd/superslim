import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ── CORS headers ──
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

// ── Validação matemática do CPF (dígitos verificadores) ──
function isValidCPF(cpf: string): boolean {
  if (cpf.length !== 11) return false;
  // Rejeita CPFs com todos os dígitos iguais (111.111.111-11 etc.)
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  // Calcula 1º dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf.charAt(i)) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  if (parseInt(cpf.charAt(9)) !== d1) return false;

  // Calcula 2º dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf.charAt(i)) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  if (parseInt(cpf.charAt(10)) !== d2) return false;

  return true;
}

Deno.serve(async (req: Request) => {
  // ── CORS preflight ──
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const cpf = (url.searchParams.get("cpf") || "").replace(/\D/g, "");

    if (!cpf || cpf.length !== 11) {
      return new Response(JSON.stringify({ error: "CPF inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isValidCPF(cpf)) {
      return new Response(JSON.stringify({ error: "CPF inválido (dígitos verificadores incorretos)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CPF válido matematicamente — retorna OK sem dados pessoais
    return new Response(JSON.stringify({
      NOME: "",
      NOME_MAE: "",
      NASC: "",
      valid: true,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[CPF] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
