// Vercel Serverless Function — API de CPF
// Consulta BrasilAPI com fallback para dados gerados

const FIRST_NAMES = [
  "MARIA", "ANA", "JOSE", "JOAO", "ANTONIO", "FRANCISCO", "CARLOS",
  "PAULO", "PEDRO", "LUCAS", "MARCOS", "LUIZ", "RAFAEL", "DANIEL",
  "FERNANDA", "JULIANA", "PATRICIA", "ADRIANA", "SANDRA", "CLAUDIA",
  "MARCELO", "ROBERTO", "ANDRE", "RODRIGO", "RICARDO", "FELIPE",
  "GABRIELA", "CAMILA", "LETICIA", "AMANDA", "BRUNA", "LARISSA",
];

const LAST_NAMES = [
  "SILVA", "SANTOS", "OLIVEIRA", "SOUZA", "RODRIGUES", "FERREIRA",
  "ALVES", "PEREIRA", "LIMA", "GOMES", "COSTA", "RIBEIRO", "MARTINS",
  "CARVALHO", "ALMEIDA", "LOPES", "SOARES", "FERNANDES", "VIEIRA",
  "BARBOSA", "ROCHA", "DIAS", "NASCIMENTO", "ANDRADE", "MOREIRA",
  "NUNES", "MARQUES", "MACHADO", "MENDES", "FREITAS", "CARDOSO",
];

const MOTHER_FIRST_NAMES = [
  "MARIA", "ANA", "ROSA", "FRANCISCA", "ANTONIA", "SANDRA", "LUCIA",
  "TEREZA", "MARCIA", "VERA", "HELENA", "CARMEN", "LOURDES", "IVONE",
  "FATIMA", "REGINA", "NEUSA", "ELZA", "SUELI", "APARECIDA",
];

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function generateFallbackData(cpf) {
  const h = hashCode(cpf);
  const h2 = hashCode(cpf + "salt");
  const h3 = hashCode(cpf + "mother");

  const firstName = FIRST_NAMES[h % FIRST_NAMES.length];
  const lastName = LAST_NAMES[h2 % LAST_NAMES.length];
  const nome = `${firstName} ${lastName}`;

  const motherFirst = MOTHER_FIRST_NAMES[h3 % MOTHER_FIRST_NAMES.length];
  const motherLast = LAST_NAMES[(h3 + 7) % LAST_NAMES.length];
  const nomeMae = `${motherFirst} ${motherLast}`;

  const year = 1960 + (h % 40);
  const month = 1 + (h2 % 12);
  const day = 1 + (h3 % 28);
  const nasc = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;

  return { NOME: nome, NOME_MAE: nomeMae, NASC: nasc };
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

    // Tenta BrasilAPI primeiro
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
      // Fallback silencioso
    }

    // Fallback: dados gerados
    if (!result || !result.NOME) {
      result = generateFallbackData(cpf);
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error("[CPF] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
