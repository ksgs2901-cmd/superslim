import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ══════════════════════════════════════════════════════════════
// CLOAKER — Edge Function
// Redireciona bots para safe page e humanos para money page
// ══════════════════════════════════════════════════════════════

// ── CORS ──
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ── Cache de campanhas em memória (evita hit no DB a cada request) ──
const campaignCache = new Map<string, { data: Campaign; cachedAt: number }>();
const CACHE_TTL_MS = 60_000; // 1 minuto

interface Campaign {
  id: string;
  slug: string;
  name: string;
  safe_url: string;
  money_url: string;
  is_active: boolean;
}

// ══════════════════════════════════════════════════════════════
// DETECÇÃO DE BOTS — User-Agent patterns
// ══════════════════════════════════════════════════════════════
const BOT_UA_PATTERNS: RegExp[] = [
  // Google
  /googlebot/i,
  /adsbot-google/i,
  /google-safety/i,
  /mediapartners-google/i,
  /google-inspectiontool/i,
  /google-adwords/i,
  /google-read-aloud/i,
  /feedfetcher-google/i,
  /google favicon/i,
  /googleweblight/i,
  /storebot-google/i,

  // Facebook / Meta
  /facebookexternalhit/i,
  /facebookbot/i,
  /facebot/i,
  /meta-externalagent/i,
  /meta-externalfetcher/i,

  // Microsoft / Bing
  /bingbot/i,
  /bingpreview/i,
  /msnbot/i,
  /adidxbot/i,

  // Outras plataformas de ads / social
  /twitterbot/i,
  /linkedinbot/i,
  /pinterest/i,
  /slurp/i,          // Yahoo
  /duckduckbot/i,
  /baiduspider/i,
  /yandexbot/i,
  /yandexmobilebot/i,
  /sogou/i,
  /exabot/i,
  /ia_archiver/i,

  // SEO crawlers
  /semrushbot/i,
  /ahrefsbot/i,
  /mj12bot/i,
  /dotbot/i,
  /rogerbot/i,
  /screaming frog/i,
  /sistrix/i,

  // Headless browsers / automação
  /headlesschrome/i,
  /phantomjs/i,
  /puppeteer/i,
  /playwright/i,
  /selenium/i,
  /webdriver/i,
  /chrome-lighthouse/i,
  /lighthouse/i,
  /gtmetrix/i,
  /pagespeed/i,

  // HTTP libraries / bots genéricos
  /wget/i,
  /curl/i,
  /python-requests/i,
  /python-urllib/i,
  /go-http-client/i,
  /java\//i,
  /axios/i,
  /node-fetch/i,
  /http\.rb/i,
  /ruby/i,
  /perl/i,
  /libwww-perl/i,
  /apache-httpclient/i,
  /okhttp/i,

  // Generic bot patterns (broad catch-all — keep last)
  /bot\b/i,
  /crawl/i,
  /spider/i,
  /scrape/i,
  /fetch/i,
];

// ══════════════════════════════════════════════════════════════
// DETECÇÃO DE BOTS — IP ranges (CIDR) de datacenters
// ══════════════════════════════════════════════════════════════
interface CIDRRange {
  network: number;
  mask: number;
  label: string;
}

function parseCIDR(cidr: string, label: string): CIDRRange {
  const [ip, bits] = cidr.split("/");
  const parts = ip.split(".").map(Number);
  const network = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  const mask = (~0 << (32 - Number(bits))) >>> 0;
  return { network: (network & mask) >>> 0, mask, label };
}

const BOT_IP_RANGES: CIDRRange[] = [
  // Google (Googlebot, AdsBot)
  parseCIDR("66.249.64.0/19", "google"),
  parseCIDR("64.233.160.0/19", "google"),
  parseCIDR("209.85.128.0/17", "google"),
  parseCIDR("216.239.32.0/19", "google"),
  parseCIDR("72.14.192.0/18", "google"),
  parseCIDR("74.125.0.0/16", "google"),
  parseCIDR("108.177.8.0/21", "google"),
  parseCIDR("173.194.0.0/16", "google"),
  parseCIDR("142.250.0.0/15", "google"),
  parseCIDR("35.190.0.0/17", "google"),
  parseCIDR("35.191.0.0/16", "google"),

  // Facebook / Meta
  parseCIDR("69.63.176.0/20", "facebook"),
  parseCIDR("69.171.224.0/19", "facebook"),
  parseCIDR("66.220.144.0/20", "facebook"),
  parseCIDR("31.13.24.0/21", "facebook"),
  parseCIDR("31.13.64.0/18", "facebook"),
  parseCIDR("157.240.0.0/16", "facebook"),
  parseCIDR("179.60.192.0/22", "facebook"),
  parseCIDR("185.60.216.0/22", "facebook"),
  parseCIDR("204.15.20.0/22", "facebook"),

  // Microsoft / Bing
  parseCIDR("40.77.167.0/24", "microsoft"),
  parseCIDR("207.46.0.0/16", "microsoft"),
  parseCIDR("65.52.0.0/14", "microsoft"),
  parseCIDR("157.55.0.0/16", "microsoft"),
  parseCIDR("157.56.0.0/16", "microsoft"),
  parseCIDR("52.160.0.0/11", "microsoft"),
  parseCIDR("13.64.0.0/11", "microsoft"),

  // Amazon AWS (ranges mais comuns usados por bots/reviewers)
  parseCIDR("54.236.0.0/15", "aws"),
  parseCIDR("54.208.0.0/15", "aws"),
  parseCIDR("52.0.0.0/11", "aws"),
  parseCIDR("18.204.0.0/14", "aws"),
];

function ipToNumber(ip: string): number {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return 0;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isIPInRanges(ip: string): { match: boolean; label: string } {
  const ipNum = ipToNumber(ip);
  if (ipNum === 0) return { match: false, label: "" };

  for (const range of BOT_IP_RANGES) {
    if (((ipNum & range.mask) >>> 0) === range.network) {
      return { match: true, label: range.label };
    }
  }
  return { match: false, label: "" };
}

// ══════════════════════════════════════════════════════════════
// ANÁLISE DO REQUEST — decide se é bot ou humano
// ══════════════════════════════════════════════════════════════
interface VerdictResult {
  verdict: "bot" | "human";
  reason: string;
}

function analyzeRequest(userAgent: string, ip: string): VerdictResult {
  // 1) Checa User-Agent
  if (!userAgent || userAgent.trim() === "") {
    return { verdict: "bot", reason: "ua:empty" };
  }

  for (const pattern of BOT_UA_PATTERNS) {
    if (pattern.test(userAgent)) {
      const matchStr = userAgent.match(pattern)?.[0] || "unknown";
      return { verdict: "bot", reason: `ua:${matchStr}` };
    }
  }

  // 2) Checa IP contra ranges de datacenters
  const ipCheck = isIPInRanges(ip);
  if (ipCheck.match) {
    return { verdict: "bot", reason: `ip:${ipCheck.label}(${ip})` };
  }

  // 3) Humano
  return { verdict: "human", reason: "passed" };
}

// ══════════════════════════════════════════════════════════════
// SUPABASE HELPERS
// ══════════════════════════════════════════════════════════════
function getSupabaseConfig() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return { url, key };
}

async function fetchCampaign(slug: string): Promise<Campaign | null> {
  // Checa cache
  const cached = campaignCache.get(slug);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const { url, key } = getSupabaseConfig();
  if (!url || !key) return null;

  try {
    const res = await fetch(
      `${url}/rest/v1/cloak_campaigns?slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&select=*&limit=1`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      }
    );

    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const campaign = rows[0] as Campaign;
    campaignCache.set(slug, { data: campaign, cachedAt: Date.now() });
    return campaign;
  } catch (err) {
    console.error("[CLOAK] Failed to fetch campaign:", err);
    return null;
  }
}

async function logAccess(log: {
  campaign_id: string | null;
  ip: string;
  user_agent: string;
  referer: string;
  country: string;
  verdict: string;
  reason: string;
  redirected_to: string;
  query_params: string;
}): Promise<void> {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return;

  try {
    await fetch(`${url}/rest/v1/cloak_logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(log),
    });
  } catch (err) {
    console.error("[CLOAK] Failed to log access:", err);
  }
}

// ══════════════════════════════════════════════════════════════
// REQUEST HANDLER
// ══════════════════════════════════════════════════════════════
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("c");

    // Sem slug → fallback para safe genérica
    if (!slug) {
      return new Response("Missing campaign parameter", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Busca campanha
    const campaign = await fetchCampaign(slug);
    if (!campaign) {
      // Campanha não encontrada → redirect para safe genérica ou 404
      console.warn(`[CLOAK] Campaign not found: ${slug}`);
      return new Response("Campaign not found", {
        status: 404,
        headers: corsHeaders,
      });
    }

    // Extrai headers do request
    const userAgent = req.headers.get("user-agent") || "";
    const referer = req.headers.get("referer") || "";
    const country =
      req.headers.get("cf-ipcountry") ||
      req.headers.get("x-country-code") ||
      req.headers.get("x-vercel-ip-country") ||
      "";

    // IP: tenta múltiplos headers (Supabase/Cloudflare/proxy)
    const ip =
      req.headers.get("x-real-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "0.0.0.0";

    // Analisa se é bot ou humano
    const { verdict, reason } = analyzeRequest(userAgent, ip);

    // Decide URL de destino
    let targetUrl: string;
    if (verdict === "bot") {
      targetUrl = campaign.safe_url;
    } else {
      // Humano: repassa UTMs e query params para a money page
      targetUrl = campaign.money_url;
      const moneyUrl = new URL(targetUrl);

      // Repassa todos os query params exceto "c" (o slug do cloaker)
      for (const [k, v] of url.searchParams.entries()) {
        if (k !== "c") {
          moneyUrl.searchParams.set(k, v);
        }
      }
      targetUrl = moneyUrl.toString();
    }

    console.log(
      `[CLOAK] slug=${slug} verdict=${verdict} reason=${reason} ip=${ip} ua=${userAgent.substring(0, 80)}`
    );

    // Log assíncrono (não bloqueia o redirect)
    const queryStr = url.search || "";
    EdgeRuntime.waitUntil(
      logAccess({
        campaign_id: campaign.id,
        ip,
        user_agent: userAgent,
        referer,
        country,
        verdict,
        reason,
        redirected_to: targetUrl,
        query_params: queryStr,
      })
    );

    // Redirect 302
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: targetUrl,
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (err) {
    console.error("[CLOAK] Unexpected error:", err);
    return new Response("Internal error", {
      status: 500,
      headers: corsHeaders,
    });
  }
});
