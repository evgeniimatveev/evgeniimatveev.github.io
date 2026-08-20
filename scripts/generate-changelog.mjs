// Summarizes the last day's commits across the portfolio repos into one
// short changelog.json entry, using Claude Haiku. Run daily by
// .github/workflows/ai-changelog.yml. Uses built-in Node fetch — no deps.

const OWNER = "evgeniimatveev";
const REPOS = [
  "route-optimization-vrp",
  "mcp-data-quality-agent",
  "cv-logistics-mlops",
  "crypto-dashboard",
  "layoffs-tracker",
  "so-survey-analytics",
  "job-market-pulse",
  "weather-pipeline",
  "olist-e-commerce-analytics",
  "uber-driver-analytics",
  "interview-coach",
  "evgeniimatveev.github.io",
];

const GH_TOKEN = process.env.GH_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

async function fetchRecentCommits(repo, sinceIso) {
  const url = `https://api.github.com/repos/${OWNER}/${repo}/commits?since=${sinceIso}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "ai-changelog-bot",
    },
  });
  if (!res.ok) return [];
  const commits = await res.json();
  if (!Array.isArray(commits)) return [];
  return commits.map((c) => `${repo}: ${c.commit.message.split("\n")[0]}`);
}

async function main() {
  const sinceIso = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
  const perRepo = await Promise.all(REPOS.map((r) => fetchRecentCommits(r, sinceIso)));
  const commitLines = perRepo.flat();

  const fs = await import("node:fs/promises");
  let history = [];
  try {
    history = JSON.parse(await fs.readFile("changelog.json", "utf8"));
  } catch {
    history = [];
  }

  if (commitLines.length === 0) {
    console.log("No commits in the last 24h across tracked repos — skipping entry.");
    return;
  }

  const prompt = `You write a single terse changelog line for a live "build log" widget on a data engineer's portfolio site. Given these raw git commit messages from the last day across his repos, write ONE sentence (max 22 words), plain text, no markdown, no "I", summarizing what actually shipped. Be specific — skip filler like "various improvements".

Commits:
${commitLines.join("\n")}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 100,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    console.error("Anthropic API error", res.status, await res.text());
    process.exit(1);
  }

  const data = await res.json();
  const summary = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  if (!summary) {
    console.log("Empty summary returned — skipping entry.");
    return;
  }

  history.unshift({ date: new Date().toISOString().slice(0, 10), summary });
  history = history.slice(0, 30);

  await fs.writeFile("changelog.json", JSON.stringify(history, null, 2) + "\n");
  console.log("Changelog updated:", summary);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
