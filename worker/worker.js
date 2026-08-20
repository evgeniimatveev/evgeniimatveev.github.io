// Cloudflare Worker — proxies "ask" questions from the portfolio terminal to Claude,
// grounded in a short set of facts about Evgenii, with per-IP + global daily rate limits.
// Deploy: see worker/README.md

const ALLOWED_ORIGIN = "https://evgeniimatveev.github.io";
const IP_DAILY_LIMIT = 8;
const GLOBAL_DAILY_LIMIT = 250;
const KV_TTL_SECONDS = 172800; // 2 days — safe buffer past the UTC day boundary

const SYSTEM_PROMPT = `You are answering, in first person as Evgenii Matveev, short factual questions a recruiter or hiring manager asks about his background, on his own portfolio site. Answer in 2-4 sentences, plain text, no markdown, confident and specific, based only on the facts below. If asked something not covered here, say you don't have that detail on hand and point to his resume, LinkedIn, or email instead of guessing.

FACTS:
- Role: Analytics & MLOps Engineer, based in Burbank, CA. Actively job searching.
- Stack: Python, SQL, dbt, Docker, GitHub Actions, OR-Tools, MLflow, PostgreSQL, DuckDB, Snowflake, Streamlit, FastAPI, Plotly, pydeck, Weights & Biases, XGBoost/CatBoost/LightGBM.
- 12 deployed, live projects (not mockups), all with CI (pytest in GitHub Actions) and uptime monitoring:
  - route-optimization-vrp — capacitated vehicle routing with time windows (OR-Tools), 18.7% distance saved, 100% vs 11% on-time delivery, ~$82/day saved.
  - mcp-data-quality-agent — 19-tool Model Context Protocol server for data quality checks across 5 databases, 33/33 tests passing.
  - cv-logistics-mlops — computer-vision bin-count classifier with MLflow + Weights & Biases tracking and weekly automated retraining.
  - olist-e-commerce-analytics — dbt-modeled e-commerce analytics, 13 dbt models, 54 tests, $13.2M revenue analyzed.
  - so-survey-analytics — query interface over the 2024 Stack Overflow Developer Survey, 65K developers, 20 SQL queries.
  - weather-pipeline — global weather ETL, 20 cities across 6 continents, twice-daily, retry logic and per-city failure resilience.
  - job-market-pulse — daily job market analytics across 10 tech stacks and 10 US cities via the Adzuna API.
  - uber-driver-analytics — analysis of 3,448 personal rideshare trips and $70K gross earnings.
  - interview-coach — interactive interview trainer, 35 questions across 5 modes, streaming responses from the Claude API.
  - crypto-onchain-dashboard — daily crypto dashboard across 8 assets (CoinGecko + Fear & Greed Index).
  - tech-layoffs-tracker — explorer over 2,412 tech layoff events, 747K people, 1,713 companies.
- All 9 live web apps sit behind UptimeRobot monitoring with email/SMS/voice alerting.
- Contact: github.com/evgeniimatveev, linkedin.com/in/evgenii-matveev-510926276, evgeniimatveevusa@gmail.com.`;

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? origin : "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json" }, headers || {}),
  });
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }
    if (request.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405, cors);
    }
    if (origin !== ALLOWED_ORIGIN) {
      return json({ error: "forbidden" }, 403, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: "bad_request" }, 400, cors);
    }

    const question = (body && body.question ? String(body.question) : "").trim().slice(0, 300);
    if (!question) {
      return json({ error: "empty_question" }, 400, cors);
    }

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const today = new Date().toISOString().slice(0, 10);
    const ipKey = `ip:${ip}:${today}`;
    const globalKey = `global:${today}`;

    const [ipCountStr, globalCountStr] = await Promise.all([
      env.RATE_LIMIT.get(ipKey),
      env.RATE_LIMIT.get(globalKey),
    ]);
    const ipCount = parseInt(ipCountStr || "0", 10);
    const globalCount = parseInt(globalCountStr || "0", 10);

    if (ipCount >= IP_DAILY_LIMIT) {
      return json({ error: "rate_limited", scope: "ip" }, 429, cors);
    }
    if (globalCount >= GLOBAL_DAILY_LIMIT) {
      return json({ error: "rate_limited", scope: "global" }, 429, cors);
    }

    let anthropicRes;
    try {
      anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 220,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: question }],
        }),
      });
    } catch (e) {
      return json({ error: "upstream_unreachable" }, 502, cors);
    }

    if (!anthropicRes.ok) {
      return json({ error: "upstream_error" }, 502, cors);
    }

    const data = await anthropicRes.json();
    const answer = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    ctx.waitUntil(
      Promise.all([
        env.RATE_LIMIT.put(ipKey, String(ipCount + 1), { expirationTtl: KV_TTL_SECONDS }),
        env.RATE_LIMIT.put(globalKey, String(globalCount + 1), { expirationTtl: KV_TTL_SECONDS }),
      ])
    );

    return json({ answer }, 200, cors);
  },
};
