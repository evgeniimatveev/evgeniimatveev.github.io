---
title: Job Market Pulse
emoji: 📊
colorFrom: blue
colorTo: indigo
sdk: docker
pinned: false
---

![Job Market Pulse Banner](assets/banner.png)

<p align="center">
  <a href="https://www.python.org/"><img src="https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white"/></a>
  <a href="https://duckdb.org/"><img src="https://img.shields.io/badge/DuckDB-1.1.3-FFF000?style=flat-square&logo=duckdb&logoColor=black"/></a>
  <a href="https://streamlit.io/"><img src="https://img.shields.io/badge/Streamlit-1.40+-FF4B4B?style=flat-square&logo=streamlit&logoColor=white"/></a>
  <a href="https://plotly.com/"><img src="https://img.shields.io/badge/Plotly-5.24-636EFA?style=flat-square&logo=plotly&logoColor=white"/></a>
  <a href=".github/workflows/pipeline.yml"><img src="https://img.shields.io/badge/GitHub_Actions-1×/day-2088FF?style=flat-square&logo=githubactions&logoColor=white"/></a>
  <a href="https://huggingface.co/spaces/evgeniimatveevusa/job-market-pulse"><img src="https://img.shields.io/badge/HuggingFace-Spaces-FFD21E?style=flat-square&logo=huggingface&logoColor=black"/></a>
</p>

<!-- MARKET_PULSE:START -->

## 📰 Today's Market Report

> 🗓️ **Aug 19 2026** &nbsp;·&nbsp; Pipeline run **#83** &nbsp;·&nbsp; 9,130 total records

| 🏆 Top Stack | 💰 Highest Paying | 🌐 Most Remote-Friendly |
|---|---|---|
| **Python** — 35,885 listings | **AWS** — $181k avg | **Azure** — 25% remote |

**Top 5 demand ranking (latest run):**

| Rank | Stack | Listings | Demand Score |
|------|-------|----------|--------------|
| 🥇 | **Python** | 35,885 | 35.4/100 |
| 🥈 | **AWS** | 27,713 | 27.4/100 |
| 🥉 | **SQL** | 23,298 | 23.0/100 |
| 4️⃣ | **Azure** | 17,193 | 17.0/100 |
| 5️⃣ | **Spark** | 7,268 | 7.2/100 |

*Auto-updated daily by [GitHub Actions](.github/workflows/pipeline.yml) · Powered by [Adzuna API](https://www.adzuna.com/)*

<!-- MARKET_PULSE:END -->

---

Daily tracking of tech job demand, salaries & remote trends across **10 tech stacks × 10 US cities + remote** — from API ingestion to a live Streamlit dashboard. Refreshed automatically **once a day** via GitHub Actions. Zero manual steps after deploy.

> *"Built an end-to-end market intelligence pipeline: API → transform → DuckDB → visualize → automate. 10 stacks. 11 locations. $0 infrastructure cost."*

**[Live Demo → HuggingFace Spaces](https://huggingface.co/spaces/evgeniimatveevusa/job-market-pulse)**

---

## Dashboard

<details>
<summary>🏆 Hero & KPI Cards</summary>

![Hero and KPIs](assets/hero_kpi.png)

</details>

<details>
<summary>📊 Demand Ranking</summary>

![Demand Ranking](assets/demand_ranking.png)

</details>

<details>
<summary>📈 Demand Trend Over Time</summary>

![Trend](assets/trend.png)

</details>

<details>
<summary>🌐 Remote Friendliness by Stack</summary>

![Remote](assets/remote.png)

</details>

<details>
<summary>💰 Salary Intelligence</summary>

![Salary](assets/salary.png)

</details>

<details>
<summary>🗺️ City Heatmap — Stack × City</summary>

![City Heatmap](assets/heatmap.png)

</details>

---

## What it tracks

| Dimension | Detail |
|-----------|--------|
| **Tech stacks** | Python · SQL · Tableau · Power BI · dbt · Spark · Airflow · Snowflake · AWS · Azure |
| **Cities** | New York · LA · Chicago · SF · Seattle · Austin · Boston · Denver · Atlanta · Dallas + Remote |
| **Metrics** | Job count · Demand score · Salary avg/min/max · Remote % · Salary disclosure rate |
| **Cadence** | Daily at 7:00 AM PST via GitHub Actions |

---

## Architecture

```
Adzuna API  ──►  extract.py  ──►  transform.py  ──►  load.py
                                                        │
                                                   DuckDB file
                                                        │
                    ┌───────────────────────────────────┤
                    │                                   │
             HuggingFace Dataset                 GitHub Actions
             (persistent storage)                (daily cron)
                    │
             HuggingFace Space
             (Streamlit dashboard)
```

**Key design decision:** DuckDB file lives on a HuggingFace Dataset — downloaded before each run, updated after. Zero database hosting cost, full history preserved indefinitely.

---

## Demand Score formula

```
demand_score = (stack_count - min_count) / (max_count - min_count) × 100
```

Normalized per run so stacks are always comparable regardless of absolute count differences. Python = 100 baseline.

---

## Day 1 findings (May 26 2026)

| Rank | Stack | Jobs | Avg Salary | Remote % |
|------|-------|------|-----------|---------|
| #1 | Python | 27,764 | $137k | 31% |
| #2 | AWS | 21,999 | $187k | 13% |
| #3 | SQL | 19,472 | $142k | 25% |
| #4 | Azure | 13,424 | $150k | 21% |
| #10 | dbt | 1,712 | $128k | 12% |

*New York dominates every single stack. Python + SQL most remote-friendly. Airflow & dbt most niche.*

---

## Tech stack

`Python` · `DuckDB` · `Streamlit` · `Plotly` · `GitHub Actions` · `HuggingFace Spaces` · `Docker` · `Adzuna API`

---

*Data from [Adzuna](https://www.adzuna.com/) · Updated daily · Built by [Evgenii Matveev](https://github.com/evgeniimatveev)*
