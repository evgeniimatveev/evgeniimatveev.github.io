# Germany Remote Job Tracker — Python · Tableau · REST API

![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)
![Tableau](https://img.shields.io/badge/Tableau-Story-blueviolet?logo=tableau)
![ETL](https://img.shields.io/badge/ETL-Pipeline-orange)
![API](https://img.shields.io/badge/API-Arbeitnow-green)
![Data](https://img.shields.io/badge/Data-JSON→CSV-yellow)
![Automation](https://img.shields.io/badge/Automation-Enabled-purple)
![Status](https://img.shields.io/badge/Status-Active-brightgreen)

---

## What This Project Does

Automates collection and visualization of **remote-friendly tech jobs in Germany** via the Arbeitnow Job API. Python ETL pipeline pulls live data → filters → exports to CSV → feeds Tableau storytelling dashboard.

Pipeline reruns in seconds to capture a fresh market snapshot at any time.

  **Pipeline:** `Arbeitnow API → JSON → Python ETL → CSV → Tableau Story (4 slides)`

  **Snapshot:** 100 listings · May 2025 · Germany tech market · 5% truly remote

---

  ## Key Findings (May 2025 snapshot — 100 listings)

  | Topic | Insight |
  |-------|---------|
  | Top Employer | MY Humancapital GmbH — **47 listings (47%)** of all 100 |
  | Top Location | Munich leads with **36 listings (36%)**, then Berlin 11%, Hamburg 4% |
  | Remote reality | Only **5 of 100 listings (5%)** truly remote — market is mostly on-site |
  | Top Roles | Softwareentwickler, IT-Support, Finance Manager |
  | Market pattern | Top 5 companies hold **72%** of all listings — highly concentrated market |

---

## ETL Pipeline — Python

```python
# jobs/arbeitnow_fetcher.py — fetch jobs from API
import requests, json

def fetch_jobs(url="https://www.arbeitnow.com/api/job-board-api"):
    response = requests.get(url)
    data = response.json()
    jobs = data.get("data", [])
    return jobs

# jobs/exporter.py — export to JSON + CSV
import csv

def export_csv(jobs, path="data/processed/jobs_clean.csv"):
    keys = ["title", "company_name", "location", "remote", "url"]
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=keys, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(jobs)
```

---

## Tableau Storytelling Reports

### Story 1 — Overview & Methodology
[Tech Job Trends in May 2025](https://github.com/evgeniimatveev/remote-job-tracker/blob/main/dashboards/tableau/storytelling_reports/Tech%20Job%20Trends%20in%20May%202025.pdf)

Project introduction, data pipeline, and overall hiring landscape.

---

### Story 2 — Top Hiring Companies
[Top Hiring Companies](https://github.com/evgeniimatveev/remote-job-tracker/blob/main/dashboards/tableau/storytelling_reports/Top%20Hiring%20Companies.pdf)

**Key Insight:** MY Humancapital GmbH dominates the dataset, accounting for nearly half of all listings — suggests either aggressive hiring or centralized job aggregation.

---

### Story 3 — Job Locations in Germany
[Where Are the Jobs Located?](https://github.com/evgeniimatveev/remote-job-tracker/blob/main/dashboards/tableau/storytelling_reports/Where%20Are%20the%20Jobs%20Located_.pdf)

**Key Insight:** Munich leads by a wide margin, followed by Berlin, Hamburg, and Karlsruhe. Remote-friendly tech hiring is concentrated in major German tech hubs.

---

### Story 4 — Roles in Demand
[What Roles Are in Demand?](https://github.com/evgeniimatveev/remote-job-tracker/blob/main/dashboards/tableau/storytelling_reports/What%20Roles%20Are%20in%20Demand_.pdf)

**Key Insight:** Software, IT support, and finance roles appear most frequently — demand spans both technical and business-oriented positions.

---

## Project Structure

```
mlops_job_project/
├── jobs/
│   ├── arbeitnow_fetcher.py    # API pull logic
│   └── exporter.py             # JSON & CSV writer
├── data/
│   ├── raw/                    # arbeitnow_raw.json
│   └── processed/              # jobs_clean.csv
├── dashboards/tableau/
│   ├── Who's Hiring in Germany.twbx
│   └── storytelling_reports/   # PDF story slides
├── main.py                     # fetch → clean → export
└── requirements.txt
```

---

## How to Run

```bash
# 1. Clone the repo
git clone https://github.com/evgeniimatveev/remote-job-tracker.git
cd remote-job-tracker

# 2. Set up environment
conda create -n job_env python=3.11 -y
conda activate job_env
pip install -r requirements.txt

# 3. Run full pipeline
python main.py
# Output: data/processed/jobs_clean.csv → open in Tableau
```

---

## Stack

| Layer | Technology |
|-------|-----------|
| Data Source | Arbeitnow Job API (REST) |
| ETL | Python (requests, csv, json) |
| Visualization | Tableau (4-slide story) |
| Output Formats | JSON + CSV |

---

## Connect

- GitHub: [evgeniimatveev](https://github.com/evgeniimatveev)
- Portfolio: [datascienceportfol.io/evgeniimatveevusa](https://www.datascienceportfol.io/evgeniimatveevusa)
- LinkedIn: [Evgenii Matveev](https://www.linkedin.com/in/evgenii-matveev-510926276/)
