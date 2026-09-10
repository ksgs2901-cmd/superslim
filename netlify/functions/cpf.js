// Netlify Serverless Function — API de CPF
// Valida CPF e retorna status. Não gera nomes falsos.

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

exports.handler = async function(event, context) {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const params = event.queryStringParameters || {};
    const cpf = (params.cpf || "").replace(/\D/g, "");

    if (!cpf || cpf.length !== 11) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "CPF inválido" })
      };
    }

    if (!isValidCPF(cpf)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "CPF inválido (dígitos verificadores incorretos)" })
      };
    }

    // CPF válido matematicamente — retorna OK sem dados pessoais inventados
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        NOME: "",
        NOME_MAE: "",
        NASC: "",
        valid: true
      })
    };
  } catch (err) {
    console.error("[CPF] Error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error" })
    };
  }
};
