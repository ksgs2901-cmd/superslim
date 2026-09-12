// Vercel Serverless Function — API de CPF
// Consulta BrasilAPI para dados reais. SEM fallback de nomes gerados.

// Validação matemática do CPF (dígitos verificadores)
function isValidCPF(cpf) {
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

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, apikey, x-client-info");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const cpf = (req.query.cpf || "").replace(/\D/g, "");

    if (!cpf || cpf.length !== 11) {
      return res.status(400).json({ error: "CPF inválido" });
    }

    if (!isValidCPF(cpf)) {
      return res.status(400).json({ error: "CPF inválido (dígitos verificadores incorretos)" });
    }

    // Tenta BrasilAPI primeiro para dados reais
    let result = null;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const apiRes = await fetch(`https://brasilapi.com.br/api/cpf/v1/${cpf}`, {
        headers: { "Accept": "application/json" },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (apiRes.ok) {
        const apiData = await apiRes.json();
        result = {
          NOME: apiData.nome || apiData.name || "",
          NOME_MAE: apiData.nome_mae || apiData.mother_name || "",
          NASC: apiData.data_nascimento || apiData.birth_date || "",
        };
      }
    } catch (_apiErr) {
      // BrasilAPI falhou ou timeout — segue sem dados
    }

    // Se BrasilAPI não retornou, retorna campos vazios (SEM nomes falsos)
    // O frontend vai pedir o nome manualmente
    if (!result || !result.NOME) {
      result = { NOME: "", NOME_MAE: "", NASC: "", valid: true };
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error("[CPF] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
