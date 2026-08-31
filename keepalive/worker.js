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

// A plain HTTP 200 doesn't mean the app is actually awake — Streamlit
// serves the "this app has gone to sleep" splash page with a 200 too, so
// checking status alone (the original version of this function) reports
// false "OK"s forever once an app falls asleep. Mirrors the fix already
// applied to the GitHub Actions ping.js in layoffs-tracker/.github/
// workflows/keepalive.yml (2026-08-30) — same wake-button detection,
// ported from Playwright's getByRole to plain DOM text matching since
// this Worker runs on @cloudflare/puppeteer instead.
async function pingOne(browser, url) {
  const page = await browser.newPage();
  try {
    const res = await page.goto(url, { waitUntil: "load", timeout: 35000 });
    await new Promise((r) => setTimeout(r, 1500));

    const clicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) =>
        /get this app back up/i.test(b.textContent || "")
      );
      if (!btn) return false;
      btn.click();
      return true;
    });

    if (!clicked) return `OK           ${url} -> HTTP ${res.status()}`;

    await new Promise((r) => setTimeout(r, 20000));
    const stillAsleep = await page.evaluate(() =>
      Array.from(document.querySelectorAll("button")).some((b) =>
        /get this app back up/i.test(b.textContent || "")
      )
    );
    return stillAsleep
      ? `STILL ASLEEP ${url} (may need another run)`
      : `ASLEEP->WOKE ${url}`;
  } catch (e) {
    return `ERR          ${url} -> ${String(e.message || e).split("\n")[0]}`;
  } finally {
    await page.close();
  }
}

async function pingAll(env) {
  const browser = await puppeteer.launch(env.MYBROWSER);
  try {
    // Parallel, not sequential — keeps total run well under the scheduled
    // handler's time budget so browser.close() below always gets reached
    // (a run that got killed mid-loop left the browser session dangling,
    // which then blocked the next cron's launch() with a 429).
    return await Promise.all(URLS.map((url) => pingOne(browser, url)));
  } finally {
    await browser.close();
  }
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
