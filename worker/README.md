# ask — Cloudflare Worker (RAG-powered)

Proxies questions from the `ask` widget on evgeniimatveev.github.io to Claude
(Haiku 4.5), grounded via **RAG**: Workers AI generates embeddings, Vectorize
does semantic search over a corpus built from all public repo READMEs,
curated STAR interview stories, and site case studies. The Anthropic API key
never touches the static site. Adds a per-IP (10/day) and global (250/day)
rate limit backed by Workers KV, so cost stays bounded no matter what.

## Architecture

```
question --> embed (Workers AI, bge-base-en-v1.5) --> Vectorize.query(topK=5)
          --> top matches (score >= 0.3) become CONTEXT
          --> STATIC_IDENTITY + CONTEXT --> Claude Haiku --> answer
```

Routes on the same Worker:
- `POST /` — the ask endpoint (Origin-restricted to the portfolio site, rate-limited, Turnstile-verified before any rate-limit KV read/write).
- `POST /admin/ingest` — (re)embeds and upserts corpus chunks into Vectorize **synchronously** (one HTTP request per batch, client waits). Gated by `ADMIN_KEY`, not Origin-restricted. Kept for one-off debugging of a single chunk.
- `POST /admin/enqueue-ingest` — the normal path for bulk (re)ingestion: pushes each chunk onto the `rag-ingest` Cloudflare Queue and returns immediately. The Worker's `queue()` export consumes it asynchronously (embed + upsert), with automatic retry (`max_retries=3`, see `wrangler.toml`) on transient failures and a `rag-ingest-dlq` dead letter queue for anything that still fails after retries — no more re-running the whole script by hand after a transient 403/timeout.
- `POST /admin/debug-query` — returns raw Vectorize matches (no Claude call), for inspecting retrieval quality in isolation. Also gated by `ADMIN_KEY`.

## Deploy

Requires a Cloudflare account (free tier is enough) and [wrangler](https://developers.cloudflare.com/workers/wrangler/):

```bash
npm install wrangler   # local install, no -g needed
npx wrangler login     # opens an OAuth consent screen in the browser
```

1. Create the KV namespace, Vectorize index, and Queues:
   ```bash
   npx wrangler kv namespace create RATE_LIMIT
   npx wrangler vectorize create evgeniimatveev-corpus --dimensions=768 --metric=cosine
   npx wrangler queues create rag-ingest
   npx wrangler queues create rag-ingest-dlq
   ```
   Paste the returned KV `id` into `wrangler.toml` (the Vectorize and Queues bindings just need the resource names, already set).

2. Create a [Turnstile widget](https://dash.cloudflare.com/?to=/:account/turnstile) (Managed mode, hostname = the site's domain) and set secrets:
   ```bash
   npx wrangler secret put ANTHROPIC_API_KEY   # your Anthropic key
   npx wrangler secret put ADMIN_KEY           # any random string you generate yourself — gates /admin/* routes
   npx wrangler secret put TURNSTILE_SECRET_KEY  # Turnstile widget's Secret key (not the Site key)
   ```
   The Turnstile **Site key** (public) goes in `index.html`'s `TURNSTILE_SITE_KEY` constant, not here.

3. Deploy:
   ```bash
   npx wrangler deploy
   ```
   This prints the live URL, e.g. `https://evgeniimatveev-ask.<subdomain>.workers.dev`.

4. Paste that URL into `ASK_ENDPOINT` near the bottom of `index.html`'s
   `<script>` block, commit, push.

5. Build and load the corpus (see `rag/` below).

## Updating the knowledge base (`rag/`)

- `rag/readmes/` — cached READMEs of all public repos (regenerate with `gh api repos/evgeniimatveev/<repo>/readme -H "Accept: application/vnd.github.raw" > rag/readmes/<repo>.md`).
- `rag/star_stories.json` — curated STAR interview stories extracted from the private interview-prep doc. **Only achievement-focused stories** — never include "weaknesses", "why looking for a new role", or other coaching-only content; those aren't for a public bot.
- `rag/build_corpus.py` — cleans (strips badges/HTML/markdown noise) and chunks everything (split by header, ~180 words/chunk) into `rag/corpus.jsonl`. Also has a hardcoded `EXTRA_RECORDS` list for bio facts / site case studies — edit there for one-off additions.
- `rag/ingest.py` — reads `corpus.jsonl` and POSTs it in batches to `/admin/enqueue-ingest` (queued, async — see Architecture above).

To refresh the whole knowledge base after editing sources:
```bash
cd rag
python build_corpus.py
ADMIN_KEY=<your admin key> python ingest.py
```
Upserts are idempotent by `id` — re-running is always safe. Since ingestion is now queued, `ingest.py` finishing just means everything was *enqueued*, not that it's in Vectorize yet — allow a minute or two, then spot-check with:
```bash
npx wrangler vectorize get-vectors evgeniimatveev-corpus-m3 --ids <some-id>
```
(Vectorize reads are eventually consistent — an empty result seconds after ingest doesn't mean it failed.)

To debug why a question retrieves the wrong context:
```bash
curl -s -X POST https://evgeniimatveev-ask.evgeniimatveevusa.workers.dev/admin/debug-query \
  -H "X-Admin-Key: <your admin key>" -H "User-Agent: Mozilla/5.0" \
  -d '{"question":"..."}'
```
(A real browser User-Agent is required — Cloudflare's edge bot-protection blocks default script user-agents like Python's `urllib`, independent of the app's own auth.)

Everything above (KV binding, Vectorize binding, AI binding, secrets) can
also be wired up by hand in the Cloudflare dashboard (Workers & Pages →
select the worker → Bindings / Settings) if you'd rather not use wrangler —
except **creating** the Vectorize index itself, which is CLI/API only as of
this writing (no "Create Index" button in the dashboard).
