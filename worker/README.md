# ask — Cloudflare Worker

Proxies questions from the `ask` widget on evgeniimatveev.github.io to Claude
(Haiku 4.5), so the Anthropic API key never touches the static site. Adds a
per-IP (8/day) and global (250/day) rate limit backed by Workers KV, so cost
stays bounded no matter what.

## Deploy

Requires a Cloudflare account (free tier is enough) and [wrangler](https://developers.cloudflare.com/workers/wrangler/):

```bash
npm install -g wrangler
wrangler login
```

1. Create the KV namespace and paste the returned `id` into `wrangler.toml`:
   ```bash
   wrangler kv namespace create RATE_LIMIT
   ```

2. Set the Anthropic API key as a secret (never goes into a file):
   ```bash
   wrangler secret put ANTHROPIC_API_KEY
   ```

3. Deploy:
   ```bash
   wrangler deploy
   ```
   This prints the live URL, e.g. `https://evgeniimatveev-ask.<subdomain>.workers.dev`.

4. Paste that URL into `ASK_ENDPOINT` near the bottom of `index.html`'s
   `<script>` block, commit, push.

Everything above can also be done by hand in the Cloudflare dashboard
(Workers & Pages → Create Worker → paste `worker.js` → Settings → Variables
→ add KV binding `RATE_LIMIT` + secret `ANTHROPIC_API_KEY`) if you'd rather
not install wrangler.
