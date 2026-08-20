// Cloudflare Worker — keeps Streamlit Cloud apps awake using native Browser
// Rendering instead of a GitHub Actions + Playwright cron. Streamlit only
// resets its sleep timer on a real browser session (a plain HTTP ping just
// returns the "sleeping" splash page), so this needs an actual headless
// browser — same reason the old Playwright job existed.

import puppeteer from "@cloudflare/puppeteer";

const URLS = [
  "https://4cmjubresrab8nk6zhjqbv.streamlit.app",
  "https://crypto-onchain-dashboard.streamlit.app",
  "https://layoffs-tracker-mdndinr8hfct5afvjwvjno.streamlit.app",
  "https://weather-pip-y645txqohstehewa3d3a4w.streamlit.app",
  "https://route-optimization-vrp.streamlit.app",
  "https://ljtn7jxeawyetzefthttnc.streamlit.app",
];

async function pingAll(env) {
  const browser = await puppeteer.launch(env.MYBROWSER);
  const results = [];
  for (const url of URLS) {
    const page = await browser.newPage();
    try {
      const res = await page.goto(url, { waitUntil: "load", timeout: 60000 });
      await new Promise((r) => setTimeout(r, 3000));
      results.push(`OK  ${url} -> HTTP ${res.status()}`);
    } catch (e) {
      results.push(`ERR ${url} -> ${String(e.message || e).split("\n")[0]}`);
    } finally {
      await page.close();
    }
  }
  await browser.close();
  return results;
}

async function runScheduled(env) {
  try {
    const results = await pingAll(env);
    console.log("keepalive run:\n" + results.join("\n"));
  } catch (e) {
    console.error("keepalive run failed:", e && e.stack ? e.stack : e);
  }
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduled(env));
  },

  // Manual trigger / health check — visiting the Worker URL runs the same ping.
  async fetch(request, env, ctx) {
    const results = await pingAll(env);
    return new Response(results.join("\n") + "\n", {
      headers: { "Content-Type": "text/plain" },
    });
  },
};
