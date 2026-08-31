// Pulls the last ~48h of response-time samples for all 9 monitored live
// apps from UptimeRobot's API and writes uptime.json — the data source for
// the response-time sparkline in the #status section. Run periodically by
// .github/workflows/uptime-snapshot.yml. Uses built-in Node fetch — no deps.

const API_KEY = process.env.UPTIMEROBOT_API_KEY;

// UptimeRobot friendly_name/url -> the app slug used in index.html's
// #status .status-row[data-app] attributes. Verified 2026-08-31 against
// the live account (9 monitors, one-to-one match).
const MONITOR_APP_MAP = {
  "route-optimization-vrp.streamlit.app": "route-optimization-vrp",
  "crypto-onchain-dashboard.streamlit.app": "crypto-onchain-dashboard",
  "layoffs-tracker-mdndinr8hfct5afvjwvjno.streamlit.app": "tech-layoffs-tracker",
  "4cmjubresrab8nk6zhjqbv.streamlit.app": "so-survey-analytics",
  "weather-pip-y645txqohstehewa3d3a4w.streamlit.app": "weather-pipeline",
  "ljtn7jxeawyetzefthttnc.streamlit.app": "interview-coach",
  "evgeniimatveevusa-job-market-pulse.hf.space": "job-market-pulse",
  "evgeniimatveevusa-olist-analytics.hf.space": "olist-e-commerce-analytics",
  "evgeniimatveevusa-uber-driver-analytics.hf.space": "uber-driver-analytics",
};

function slugFor(monitor) {
  const host = (monitor.url || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const name = (monitor.friendly_name || "").replace(/\/$/, "");
  return MONITOR_APP_MAP[host] || MONITOR_APP_MAP[name] || null;
}

async function main() {
  if (!API_KEY) {
    console.log("No UPTIMEROBOT_API_KEY set — skipping.");
    return;
  }

  const body = new URLSearchParams({
    api_key: API_KEY,
    format: "json",
    response_times: "1",
    response_times_limit: "48",
  });

  const res = await fetch("https://api.uptimerobot.com/v2/getMonitors", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body,
  });
  const data = await res.json();
  if (data.stat !== "ok") {
    console.error("UptimeRobot API error:", JSON.stringify(data));
    process.exitCode = 1;
    return;
  }

  const apps = {};
  for (const m of data.monitors || []) {
    const slug = slugFor(m);
    if (!slug) continue;
    const points = (m.response_times || [])
      .slice()
      .sort((a, b) => a.datetime - b.datetime)
      .map((p) => p.value);
    apps[slug] = {
      status: m.status === 2 ? "up" : "down",
      points,
      avgMs: points.length ? Math.round(points.reduce((a, b) => a + b, 0) / points.length) : null,
    };
  }

  const out = { generated: new Date().toISOString(), apps };

  const fs = await import("node:fs/promises");
  await fs.writeFile("uptime.json", JSON.stringify(out, null, 2) + "\n");
  console.log(`Wrote uptime.json — ${Object.keys(apps).length}/${Object.keys(MONITOR_APP_MAP).length} apps mapped.`);
}

main();
