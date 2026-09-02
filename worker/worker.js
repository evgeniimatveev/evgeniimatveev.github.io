// Cloudflare Worker — proxies "ask" questions from the portfolio terminal to Claude,
// grounded via RAG (Workers AI embeddings + Vectorize) over a corpus of READMEs,
// STAR stories, and case studies, with per-IP + global daily rate limits.
// Deploy: see worker/README.md

const ALLOWED_ORIGIN = "https://evgeniimatveev.github.io";
const IP_DAILY_LIMIT = 10;
const GLOBAL_DAILY_LIMIT = 250;
const KV_TTL_SECONDS = 172800; // 2 days — safe buffer past the UTC day boundary
const TOTAL_KEY = "total:questions"; // no TTL — running counter since this key was introduced

const EMBEDDING_MODEL = "@cf/baai/bge-m3";
const TOP_K = 6;
const MIN_SCORE = 0.3; // below this, a retrieved chunk is probably irrelevant noise

const STATIC_IDENTITY = `You are answering, in first person as Evgenii Matveev, short factual questions a recruiter or hiring manager asks about his background, on his own portfolio site. Answer in 2-4 sentences, plain text, no markdown, confident and specific, based only on the CONTEXT provided below (retrieved from his real projects, READMEs, and interview prep notes). If the context does not cover what's asked, say you don't have that detail on hand and point to his resume, LinkedIn, or email instead of guessing. Never invent numbers or claims not present in the context. Match the language of the question in your reply.

Core facts always true: Analytics & MLOps Engineer, based in Burbank, CA, actively job searching. Stack: Python, SQL, dbt, Docker, GitHub Actions, OR-Tools, MLflow, PostgreSQL, DuckDB, Snowflake, Streamlit, FastAPI. Contact: github.com/evgeniimatveev, linkedin.com/in/evgenii-matveev-510926276, evgeniimatveevusa@gmail.com.`;

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? origin : "null",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
    "Vary": "Origin",
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json" }, headers || {}),
  });
}

function detectScriptHint(text) {
  if (/[一-鿿]/.test(text)) return "Reply in Chinese.";
  if (/[぀-ヿ]/.test(text)) return "Reply in Japanese.";
  if (/[가-힯]/.test(text)) return "Reply in Korean.";
  if (/[Ѐ-ӿ]/.test(text)) return "Reply in Russian.";
  if (/[؀-ۿ]/.test(text)) return "Reply in Arabic.";
  if (/[฀-๿]/.test(text)) return "Reply in Thai.";
  if (/[֐-׿]/.test(text)) return "Reply in Hebrew.";
  return null;
}

// Lightweight script-based language tag for analytics — same ranges as
// detectScriptHint, just returned as a short code instead of an instruction.
// Anything outside these scripts (incl. Latin-script languages other than
// English) is bucketed as "en" — coarse on purpose, this is a stats widget,
// not a language detector.
function detectLanguage(text) {
  if (/[一-鿿]/.test(text)) return "zh";
  if (/[぀-ヿ]/.test(text)) return "ja";
  if (/[가-힯]/.test(text)) return "ko";
  if (/[Ѐ-ӿ]/.test(text)) return "ru";
  if (/[؀-ۿ]/.test(text)) return "ar";
  if (/[฀-๿]/.test(text)) return "th";
  if (/[֐-׿]/.test(text)) return "he";
  return "en";
}

// Keyword-based topic tag for analytics — cheap (no extra model call),
// checked most-specific-first since a question can match multiple buckets.
// Coarse by design (see project notes): this is a public "top topic" stat,
// not an analytical product, so a rough bucket is good enough.
const TOPIC_RULES = [
  ["incident", /\b(incident|outage|bug|debug|production|postmortem|root cause)\b/i],
  ["sql-dbt", /\b(sql|dbt|query|queries|database|postgres|snowflake|duckdb|schema)\b/i],
  ["stack", /\b(stack|tech stack|tool|python|docker|mlflow|streamlit|fastapi|airflow|cloudflare|worker)\b/i],
  ["logistics", /\b(visa|relocat|sponsor|work auth|remote|onsite|salary|rate|hire|available)\b/i],
  ["projects", /\b(project|portfolio|github|repo|demo|built|build)\b/i],
  ["career", /\b(why|leaving|motivation|background|experience|career|job search)\b/i],
];

function classifyTopic(text) {
  for (const [topic, pattern] of TOPIC_RULES) {
    if (pattern.test(text)) return topic;
  }
  return "other";
}

async function embed(env, text) {
  const res = await env.AI.run(EMBEDDING_MODEL, { text: [text] });
  return res.data[0];
}

async function handleAsk(request, env, ctx, cors) {
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

  const ipCountStr = await env.RATE_LIMIT.get(ipKey);
  const globalCountStr = await env.RATE_LIMIT.get(globalKey);
  const totalCountStr = await env.RATE_LIMIT.get(TOTAL_KEY);
  const ipCount = parseInt(ipCountStr || "0", 10);
  const globalCount = parseInt(globalCountStr || "0", 10);
  const totalCount = parseInt(totalCountStr || "0", 10);

  if (ipCount >= IP_DAILY_LIMIT) {
    return json({ error: "rate_limited", scope: "ip" }, 429, cors);
  }
  if (globalCount >= GLOBAL_DAILY_LIMIT) {
    return json({ error: "rate_limited", scope: "global" }, 429, cors);
  }

  // --- Retrieval ---
  let contextBlock = "";
  try {
    const queryVector = await embed(env, question);
    const matches = await env.VECTORIZE.query(queryVector, { topK: TOP_K, returnMetadata: true });
    const relevant = (matches.matches || []).filter((m) => m.score >= MIN_SCORE);
    if (relevant.length > 0) {
      contextBlock = relevant
        .map((m) => `[source: ${m.metadata.source}]\n${m.metadata.text}`)
        .join("\n\n");
    }
  } catch (e) {
    // Retrieval failure shouldn't take down the whole answer — fall back to identity-only.
    contextBlock = "";
  }

  const systemPrompt = contextBlock
    ? `${STATIC_IDENTITY}\n\nCONTEXT:\n${contextBlock}`
    : STATIC_IDENTITY;

  // A general "answer in the question's language" instruction buried in a long
  // system prompt isn't reliable enough on its own for non-Latin scripts —
  // attach an explicit directive directly next to the question itself instead,
  // which the model follows far more consistently than a system-level rule.
  const scriptHint = detectScriptHint(question);
  const userContent = scriptHint ? `[${scriptHint}]\n\n${question}` : question;

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
        max_tokens: 600,
        temperature: 0,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
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

  const newTotal = totalCount + 1;
  const topic = classifyTopic(question);
  const language = detectLanguage(question);
  // allSettled, not all: if any one write rejects, Promise.all would settle
  // (reject) immediately without waiting for the others, and Cloudflare can
  // then end the request's extended lifetime before the stragglers finish —
  // silently dropping a KV/D1 write. allSettled always waits for everything.
  ctx.waitUntil(
    Promise.allSettled([
      env.RATE_LIMIT.put(ipKey, String(ipCount + 1), { expirationTtl: KV_TTL_SECONDS }),
      env.RATE_LIMIT.put(globalKey, String(globalCount + 1), { expirationTtl: KV_TTL_SECONDS }),
      env.RATE_LIMIT.put(TOTAL_KEY, String(newTotal)), // no TTL — persists indefinitely
      env.DB.prepare(
        "INSERT INTO questions (topic, language, created_at) VALUES (?, ?, ?)"
      ).bind(topic, language, new Date().toISOString()).run(),
    ])
  );

  return json({ answer, total: newTotal }, 200, cors);
}

// Public, unauthenticated, read-only — the running "questions answered"
// counter plus a topic/language breakdown, so the frontend can show both
// without spending a rate-limited ask. Breakdown starts from the day D1
// analytics shipped — no historical backfill, the KV counter predates it.
async function handleStats(env, cors) {
  const totalStr = await env.RATE_LIMIT.get(TOTAL_KEY);
  const [topicsResult, languagesResult] = await Promise.all([
    env.DB.prepare(
      "SELECT topic, COUNT(*) as count FROM questions GROUP BY topic ORDER BY count DESC LIMIT 5"
    ).all(),
    env.DB.prepare(
      "SELECT language, COUNT(*) as count FROM questions GROUP BY language ORDER BY count DESC LIMIT 5"
    ).all(),
  ]);
  return json(
    {
      total: parseInt(totalStr || "0", 10),
      topics: topicsResult.results || [],
      languages: languagesResult.results || [],
    },
    200,
    cors
  );
}

// One-off / re-runnable ingestion endpoint. Protected by ADMIN_KEY (a secret this
// project owns — not a third-party credential). Body: { chunks: [{id, source, text}] }
async function handleIngest(request, env, cors) {
  const adminKey = request.headers.get("X-Admin-Key") || "";
  if (!env.ADMIN_KEY || adminKey !== env.ADMIN_KEY) {
    return json({ error: "forbidden" }, 403, cors);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "bad_request" }, 400, cors);
  }

  const chunks = Array.isArray(body.chunks) ? body.chunks : [];
  if (chunks.length === 0) {
    return json({ error: "no_chunks" }, 400, cors);
  }

  const vectors = [];
  for (const chunk of chunks) {
    const vec = await embed(env, chunk.text);
    vectors.push({
      id: chunk.id,
      values: vec,
      metadata: { source: chunk.source, text: chunk.text },
    });
  }

  await env.VECTORIZE.upsert(vectors);

  return json({ upserted: vectors.length }, 200, cors);
}

// Debug route — returns raw Vectorize matches (no Claude call) so retrieval
// quality can be inspected in isolation from generation.
async function handleDebugQuery(request, env, cors) {
  const adminKey = request.headers.get("X-Admin-Key") || "";
  if (!env.ADMIN_KEY || adminKey !== env.ADMIN_KEY) {
    return json({ error: "forbidden" }, 403, cors);
  }
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "bad_request" }, 400, cors);
  }
  const question = (body && body.question ? String(body.question) : "").trim();
  if (!question) return json({ error: "empty_question" }, 400, cors);

  const queryVector = await embed(env, question);
  const matches = await env.VECTORIZE.query(queryVector, { topK: 10, returnMetadata: true });
  return json(
    {
      matches: (matches.matches || []).map((m) => ({
        id: m.id,
        score: m.score,
        source: m.metadata.source,
        text: m.metadata.text.slice(0, 150),
      })),
    },
    200,
    cors
  );
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }
    if (request.method === "GET" && url.pathname === "/stats") {
      if (origin !== ALLOWED_ORIGIN) {
        return json({ error: "forbidden" }, 403, cors);
      }
      return handleStats(env, cors);
    }
    if (request.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405, cors);
    }

    if (url.pathname === "/admin/ingest") {
      // Admin route: no Origin restriction (called from a local script, not the browser).
      return handleIngest(request, env, cors);
    }
    if (url.pathname === "/admin/debug-query") {
      return handleDebugQuery(request, env, cors);
    }

    if (origin !== ALLOWED_ORIGIN) {
      return json({ error: "forbidden" }, 403, cors);
    }

    return handleAsk(request, env, ctx, cors);
  },
};
