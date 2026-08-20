# streamlit-keepalive — Cloudflare Worker

Replaces the old GitHub Actions + Playwright keepalive with native
Cloudflare Browser Rendering. Same reason as before: Streamlit Cloud only
resets its sleep timer on a real browser session — a plain HTTP ping just
returns the "sleeping" splash page — so this still needs an actual headless
browser, just running on Cloudflare's infra instead of a GitHub-hosted runner.

## What it does

Every 30 minutes (Cron Trigger), visits 6 Streamlit Cloud apps with a
headless Chromium instance (`@cloudflare/puppeteer` + Browser Rendering),
waits for `load` + a 3s settle, closes the page, moves to the next.

Visiting the Worker URL directly also runs the same ping — useful as a
manual trigger or health check.

## Deploy

```bash
npm install
npm install wrangler
npx wrangler deploy
```

No secrets needed — Browser Rendering is a plain binding (`[browser]` in
`wrangler.toml`), no API key.

## Migration status

This runs **in parallel** with the old `.github/workflows/keepalive.yml` in
the `layoffs-tracker` repo for now. Before removing the GitHub Actions
version:

1. Watch **Workers & Pages → streamlit-keepalive → Metrics** and the
   account's Browser Rendering usage panel in the Cloudflare dashboard for
   a few days.
2. Confirm actual daily browser-minute usage stays inside the plan's quota
   (6 URLs × 48 runs/day, each URL taking roughly 6-10s, is close to
   30-40 min/day — worth confirming against the free-tier allowance before
   cutting the GitHub Actions job).
3. Once confirmed stable, delete `.github/workflows/keepalive.yml` from
   `layoffs-tracker`.

HF Spaces don't need this — their free tier wakes on any plain HTTP
request, so the existing hourly `curl` keepalive stays as-is.
