# 🎓 Data Interview Coach

![Deploy](https://github.com/evgeniimatveev/interview-coach/actions/workflows/deploy.yml/badge.svg)
![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python&logoColor=white)
![Claude API](https://img.shields.io/badge/Claude-Sonnet-orange?logo=anthropic&logoColor=white)
![Streamlit](https://img.shields.io/badge/Streamlit-1.58-red?logo=streamlit&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-embedded-lightgrey?logo=sqlite&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-deployed-blue?logo=docker&logoColor=white)
![HuggingFace](https://img.shields.io/badge/🤗-HF_Spaces-yellow)

AI-powered interview practice tool for Data Analyst / Analytics Engineer roles.  
Practice SQL, behavioral, and project-deep questions — Claude evaluates each answer live with streaming feedback.

**[🤗 Live Demo on HuggingFace Spaces →](https://huggingface.co/spaces/evgeniimatveevusa/interview-coach)**  
*Seeded with 6 demo sessions showing a realistic 3-week improvement arc. CLI requires local setup with your own Anthropic API key.*

---

## Architecture

```
┌──────────────┐   answer    ┌─────────────────────┐   streaming   ┌───────────────────┐
│   👤 User    │──────────→  │   🖥️  coach.py       │─────────────→ │  🤖 Claude Sonnet  │
│              │ ←────────── │   Rich CLI           │ ←──────────── │  API + caching    │
└──────────────┘  feedback   └──────────┬──────────┘   scored eval  └───────────────────┘
                                        │ save session
                              ┌─────────▼─────────┐
                              │  💾 SQLite DB      │
                              │  interview.db      │
                              └─────────┬─────────┘
                                        │ read history
                              ┌─────────▼─────────┐      deploy     ┌────────────────┐
                              │  📊 dashboard.py   │───────────────→ │  🤗 HF Spaces  │
                              │  Streamlit         │                 │  Docker        │
                              └───────────────────┘                 └────────────────┘
```

---

## Practice modes

| Mode | Questions | Focus |
|------|-----------|-------|
| SQL Drill | 12 | Window functions · CTEs · UNNEST · LAG · Cohort · Dedup · WHERE vs HAVING |
| Behavioral | 9 | STAR stories · Tell me about yourself · Weakness · 5-year goal |
| Project Deep | 8 | Olist · Uber · Weather Pipeline · MCP Agent · SO Survey · HR BI · Interview Coach |
| Stats & A/B Testing | 6 | Mean vs Median · p-value · Type I/II errors · A/B test design · Pitfalls |
| Mixed | 12 | All categories — real interview simulation |

---

## Dashboard

<details>
<summary>📊 KPI Overview</summary>

![KPI Header](assets/01_kpi_header.png)

![Interview Readiness Gauge + Practice Next](assets/02_readiness_gauge.png)

</details>

<details>
<summary>📈 Score Analytics</summary>

![Score Trend Over Time + Score by Category](assets/03_score_analytics.png)

</details>

<details>
<summary>🎯 Skills Radar</summary>

![Skills Radar — SQL · Behavioral · Project](assets/05_skills_radar.png)

</details>

<details>
<summary>📋 Performance by Topic</summary>

![Performance by Topic — horizontal bar chart](assets/06_performance_topic.png)

![Topic Summary table](assets/08_topic_summary.png)

</details>

<details>
<summary>📅 Session History</summary>

![Session History](assets/07_session_history.png)

</details>

<details>
<summary>📝 Recent Answers & Claude Feedback</summary>

*Each answer is scored 1–10 with specific, actionable feedback from Claude Sonnet.*

![Recent Answers & Feedback — part 1](assets/09_feedback_1.png)

![Recent Answers & Feedback — part 2](assets/10_feedback_2.png)

![Recent Answers & Feedback — part 3](assets/11_feedback_3.png)

</details>

---

## Features

- **Streaming feedback** — Claude's evaluation appears word-by-word in the terminal
- **Prompt caching** — system prompt cached across questions (~70% cost reduction)
- **Progress tracking** — SQLite stores every answer; dashboard shows trend, radar, weak spots
- **Interview Readiness gauge** — weighted score (SQL 40% · Behavioral 35% · Project 25%)
- **Practice Next panel** — auto-recommends the 3 weakest topics each session

---

## Stack

`Python 3.11` · `Anthropic Claude API` (streaming + prompt caching) · `Rich` · `Streamlit` · `Plotly` · `SQLite` · `Docker`

---

## Local setup

```bash
git clone https://github.com/evgeniimatveev/interview-coach
cd interview-coach
python -m venv .venv && .venv\Scripts\activate   # Windows
pip install -r requirements.txt
cp .env.example .env                              # add ANTHROPIC_API_KEY
python coach.py
```

```bash
streamlit run dashboard.py   # dashboard only (no API key needed)
```

---

Built by [Evgenii Matveev](https://datascienceportfol.io/evgeniimatveevusa) · May 2026
