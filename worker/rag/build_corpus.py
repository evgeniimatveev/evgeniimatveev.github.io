"""
Cleans downloaded READMEs + curated facts into chunked corpus.jsonl for RAG ingestion.

Cleaning strategy (why each step exists):
- Strip HTML comments / badge images / raw <img> tags: shields.io badges and GIF
  banners are pure noise for an embedding model — they inflate token count and
  dilute the vector with markup instead of meaning.
- Collapse markdown link syntax to plain text: "[text](url)" -> "text" — the URL
  itself rarely helps semantic search, but keeping it as a link disrupts sentence
  flow for the embedding model.
- Drop lines that are just table separators / pure punctuation.

Chunking strategy:
- Split by markdown headers first (##, ###) — headers are natural topic
  boundaries, so chunks stay semantically coherent (one chunk = one concept),
  which is what actually matters for retrieval quality, not a fixed token count.
- Within a header section, if it's still too long, split by paragraph and merge
  small paragraphs together up to ~180 words per chunk (small enough for precise
  retrieval, large enough to keep context intact).
- Every chunk keeps a `source` tag (repo/file name) so the worker can prepend
  "From <source>:" when building the prompt — helps the model attribute claims
  correctly instead of blending sources together.
"""

import json
import re
from pathlib import Path

README_DIR = Path(__file__).parent / "readmes"
STAR_JSON = Path(__file__).parent / "star_stories.json"
OUT_FILE = Path(__file__).parent / "corpus.jsonl"

MAX_WORDS = 180
MIN_WORDS = 25


def clean_markdown(text: str) -> str:
    text = re.sub(r"<!--.*?-->", "", text, flags=re.DOTALL)
    text = re.sub(r"<img[^>]*>", "", text)
    text = re.sub(r"<p[^>]*>|</p>", "", text)
    text = re.sub(r"<div[^>]*>|</div>", "", text)
    text = re.sub(r"<a[^>]*>|</a>", "", text)
    text = re.sub(r"!\[([^\]]*)\]\([^)]*\)", "", text)  # image markdown
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1", text)  # link -> text
    text = re.sub(r"^\|.*\|$", lambda m: m.group(0), text, flags=re.MULTILINE)
    text = re.sub(r"^\s*[-|:]+\s*$", "", text, flags=re.MULTILINE)  # table separators
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_by_headers(text: str):
    parts = re.split(r"\n(?=#{1,3}\s)", text)
    return [p.strip() for p in parts if p.strip()]


def chunk_section(section: str):
    lines = [l for l in section.split("\n") if l.strip()]
    header = lines[0] if lines and lines[0].startswith("#") else None
    body_lines = lines[1:] if header else lines
    body = "\n".join(body_lines)

    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", body) if p.strip()]
    chunks, buf = [], []
    buf_words = 0
    for para in paragraphs:
        w = len(para.split())
        if buf_words + w > MAX_WORDS and buf:
            chunks.append(" ".join(buf))
            buf, buf_words = [], 0
        buf.append(para)
        buf_words += w
    if buf:
        chunks.append(" ".join(buf))

    # merge tiny trailing chunks into the previous one
    merged = []
    for c in chunks:
        if merged and len(c.split()) < MIN_WORDS:
            merged[-1] = merged[-1] + " " + c
        else:
            merged.append(c)

    if header:
        return [f"{header}\n{c}" for c in merged]
    return merged


EXTRA_RECORDS = [
    {
        "id": "bio:summary",
        "source": "datascienceportfol.io bio",
        "text": "Evgenii Matveev is a Data & MLOps Engineer with hands-on experience in SQL, Python, Docker, and CI/CD automation. He builds end-to-end data pipelines, automates analytics workflows, and delivers business insights through Tableau and reproducible MLOps systems powered by MLflow, DuckDB, and GitHub Actions. Title: Analytics & MLOps Engineer. Based in Burbank, CA.",
    },
    {
        "id": "bio:background",
        "source": "career background",
        "text": (
            "Evgenii has an Engineer degree in Transportation Organization and Management (2006-2011) — a non-CS background, career-changer story into data analytics. "
            "He completed a structured QA training program (SkillBox) with a personal curator/mentor, covering manual and automated testing in Python — writing test cases, "
            "finding and documenting bugs in web and mobile UI (buttons, search, forms), and tracking them in Jira. That QA training is part of what shaped his engineering rigor. "
            "From October 2022 he drove for Uber in Los Angeles (3,448+ trips, $70K gross, 98.9% rating) while building his data analytics skill set. "
            "Around the same period (~3 years before his current SQL/Python/R/Tableau stack), in mid-2023 (Jul-Sep) he also did brief freelance software QA testing via Testlio "
            "alongside driving — gig-based work, not a formal QA engineering job; competition on the platform was high and it did not become his main path. "
            "He fully transitioned into data analytics and MLOps from there — Python, R, Tableau, SQL — carrying the QA mindset (rigor around test cases, edge cases, and validation) "
            "into his data quality and CI/CD work today."
        ),
    },
    {
        "id": "case:route-optimization-vrp",
        "source": "site case study — route-optimization-vrp",
        "text": "route-optimization-vrp postmortem: A naive nearest-neighbor dispatcher missed 40 of 45 delivery windows because it drives to the closest stop with no awareness of promised time slots. Solution: Capacitated VRP with time windows via Google OR-Tools — a haversine distance matrix, a capacity dimension, a separate time dimension with per-stop windows, and disjunction-with-penalty so infeasible configs still return a partial plan instead of failing outright. Incident (2026-08-18): the app was crashing in production with an AttributeError. Traced to one line — search_parameters.num_search_workers = 1 — a field that does not exist on the classic routing solver's RoutingSearchParameters proto in the pinned OR-Tools version (it belongs to CP-SAT's params, not this solver). Confirmed by enumerating the live proto's actual fields rather than trusting the earlier assumption, removed the line, verified the fix live within the hour. Result: 18.7% distance saved, 100% vs 11% on-time, ~$82/day saved.",
    },
    {
        "id": "case:mcp-data-quality-agent",
        "source": "site case study — mcp-data-quality-agent",
        "text": "mcp-data-quality-agent postmortem: Data-quality checks (null patterns, duplicates, freshness, anomalies) were ad hoc, one-off scripts with no shared interface across databases. Built a 19-tool MCP server (profiling, anomaly detection, freshness checks, correlation, significance testing) that any MCP-compatible client can call directly against 5 connected databases. Result: 19 tools, 33/33 tests passing, 5 databases.",
    },
    {
        "id": "case:cv-logistics-mlops",
        "source": "site case study — cv-logistics-mlops",
        "text": "cv-logistics-mlops postmortem: Manual bin-count checks in a logistics workflow are slow and inconsistent between people. Built a CV classifier with every experiment tracked in MLflow and Weights & Biases, wired to a scheduled retraining job so the model does not quietly drift. Running in production with weekly automated retrain.",
    },
    {
        "id": "infra:keepalive",
        "source": "site infra.log",
        "text": "Streamlit Cloud only resets its sleep timer on a real browser session — a plain HTTP ping just returns the sleeping splash page. Fixed with a Playwright headless-Chromium ping every 30 minutes across a GitHub Actions cron. HF Spaces do not need that — their free tier wakes on any plain HTTP request, so an hourly curl is enough.",
    },
    {
        "id": "infra:monitoring",
        "source": "site infra.log",
        "text": "All 9 live apps sit behind UptimeRobot with email/SMS/voice alerting. The last two monitors were added the same day a fix for an intermittent crash turned it into a guaranteed one — the app was broken and live for hours before anyone noticed by hand.",
    },
    {
        "id": "bio:tableau_deployment",
        "source": "stack clarification",
        "text": (
            "Evgenii is strong in Tableau specifically — he holds a Tableau certificate listed on his LinkedIn profile, "
            "not just general familiarity, and uses it for interactive dashboards and data storytelling (filters, calculated fields, executive-ready visuals). "
            "On deployment: he uses Hugging Face mainly as storage — 4 datasets hosted there — while the actual dashboard "
            "applications (the interactive UI people click through) run on Streamlit Cloud, including the ones referenced as "
            "'HF Spaces' in older docs. In practice, Streamlit Cloud is his primary app-hosting platform across nearly all portfolio projects."
        ),
    },
    {
        "id": "infra:cicd",
        "source": "site infra.log",
        "text": "Every repo runs its pytest suite in GitHub Actions before anything ships — routing feasibility, capacity limits, time-window compliance, and optimized actually beats baseline are all asserted, not eyeballed.",
    },
]


def build_records():
    records = []

    for md_file in sorted(README_DIR.glob("*.md")):
        repo = md_file.stem
        raw = md_file.read_text(encoding="utf-8")
        cleaned = clean_markdown(raw)
        if len(cleaned.split()) < MIN_WORDS:
            continue
        for section in split_by_headers(cleaned):
            for chunk in chunk_section(section):
                if len(chunk.split()) < MIN_WORDS:
                    continue
                records.append({
                    "id": f"readme:{repo}:{len(records)}",
                    "source": f"github.com/evgeniimatveev/{repo}",
                    "text": chunk[:2000],
                })

    if STAR_JSON.exists():
        stories = json.loads(STAR_JSON.read_text(encoding="utf-8"))
        excluded_markers = ["mistake", "failed", "disagreed", "5 years"]
        for name, body in stories.items():
            if any(m in name.lower() for m in excluded_markers):
                continue
            records.append({
                "id": f"star:{name}",
                "source": "interview prep — STAR story",
                "text": f"{name}\n{body}"[:2000],
            })

    records.extend(EXTRA_RECORDS)
    return records


if __name__ == "__main__":
    records = build_records()
    with OUT_FILE.open("w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"Wrote {len(records)} chunks to {OUT_FILE}")
