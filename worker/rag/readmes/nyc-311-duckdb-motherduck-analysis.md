# NYC 311 Elevator Complaints — DuckDB · MotherDuck · Docker · Python

![DuckDB](https://img.shields.io/badge/DuckDB-Analytics-orange?logo=duckdb&logoColor=white)
![MotherDuck](https://img.shields.io/badge/MotherDuck-Cloud-blue)
![Python](https://img.shields.io/badge/Python-ETL-yellow?logo=python&logoColor=black)
![SQL](https://img.shields.io/badge/SQL-Analysis-lightgrey)
![Docker](https://img.shields.io/badge/Docker-Containerization-blue?logo=docker&logoColor=white)
![Status](https://img.shields.io/badge/Status-Active-brightgreen)

---

## What This Project Does

Analyzes **NYC 311 Elevator Service Requests** — real open city data — to uncover complaint patterns across boroughs, seasons, and building types.

Fully reproducible ELT pipeline: raw CSV → DuckDB transformations → validated CSV/Parquet exports → MotherDuck cloud layer.

**Pipeline:** `Raw CSV → DuckDB ELT → Export (CSV + Parquet) → Validation → MotherDuck`

**Dataset:** 22,504 real NYC 311 elevator service requests  

---

 ## Key Findings

  | Finding | Detail |
  |---------|--------|
  | Bronx dominates complaint volume | **9,339 complaints — 41.5%** of all 22,504 records |
  | Clear summer peak | July peaks at **2,432 complaints** — 62% above February low (1,502) |
  | DOB handles nearly all requests | DOB: **20,825 records (92.5%)** — centralized but potential bottleneck |
  | Single-device failures lead | "No alternate service": **13,195 cases (58.6%** of all complaints) |
  | Staten Island vs Bronx gap | **208 complaints (0.9%)** vs Bronx **41.5%** — 45× difference |

---

## SQL — DuckDB Patterns

### Seasonal Trend by Borough

```sql
SELECT
    DATE_TRUNC('month', created_date)::DATE        AS month,
    borough,
    COUNT(*)                                        AS complaints,
    ROUND(
        COUNT(*) * 100.0 /
        SUM(COUNT(*)) OVER (PARTITION BY DATE_TRUNC('month', created_date)),
        1
    )                                               AS pct_of_month
FROM read_csv_auto('data/311_Elevator_Service_Requests_.csv')
WHERE borough != 'Unspecified'
GROUP BY 1, 2
ORDER BY 1, complaints DESC;
```

### Peak Month Detection (Window Function)

```sql
WITH monthly_stats AS (
    SELECT
        EXTRACT(year  FROM created_date) AS yr,
        EXTRACT(month FROM created_date) AS mo,
        COUNT(*)                         AS complaints
    FROM clean_requests
    GROUP BY 1, 2
)
SELECT
    yr,
    mo,
    complaints,
    RANK() OVER (PARTITION BY yr ORDER BY complaints DESC) AS rank_in_year
FROM monthly_stats
ORDER BY yr, rank_in_year;
```

### Query Performance Inspection

```sql
-- DuckDB EXPLAIN ANALYZE — real execution metrics
EXPLAIN ANALYZE
SELECT borough, COUNT(*) AS total
FROM clean_requests
GROUP BY borough
ORDER BY total DESC;
```

---

## Architecture

```
Raw CSV (NYC Open Data)
    └── DuckDB ELT (4_2_elt.py)
            ├── SQL transformations + aggregations
            └── Export pipeline (4_3_export.py)
                    ├── clean_requests.csv
                    ├── clean_requests.parquet
                    └── check_exports.py (CSV vs Parquet validation)
                            └── MotherDuck (cloud analytics layer)
```

---

## Project Structure

```
nyc-311-duckdb-motherduck-analysis/
├── data/
│   └── 311_Elevator_Service_Requests_.csv
├── exports/
│   ├── clean_requests.csv
│   └── clean_requests.parquet
├── scripts/
│   ├── 4_2_elt.py          # ELT pipeline
│   ├── 4_3_export.py       # CSV + Parquet export
│   ├── check_exports.py    # consistency validation
│   ├── run_pipeline.py     # full pipeline runner
│   └── smoke_test_duckdb.py
├── screenshots/
│   ├── DBeaver/
│   ├── DuckDB(CLI)/
│   └── Storytelling/
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

---

## How to Run

```bash
# 1. Clone the repo
git clone https://github.com/evgeniimatveev/nyc-311-duckdb-motherduck-analysis.git
cd nyc-311-duckdb-motherduck-analysis

# 2. Run smoke test
python scripts/smoke_test_duckdb.py

# 3. Run full pipeline (Docker)
docker compose run --rm duckdb_pipeline        # ELT
docker compose run --rm export_pipeline        # Export
docker compose run --rm duckdb_pipeline python scripts/check_exports.py  # Validate

# 4. Or run everything at once
docker compose run --rm pipeline_runner
```

---

## Pipeline Validation Checklist

- Repository cloned into clean environment
- Docker image built successfully
- ELT pipeline completed with exit code 0
- CSV and Parquet exports generated
- Output consistency verified between formats

---

## Data Storytelling

<details>
<summary>Monthly Trend by Borough</summary>

**Insight:** Seasonal trends are consistent across boroughs, with mid-year increases observed everywhere, while absolute complaint volume varies significantly by location.

![Monthly Trend](screenshots/Storytelling/Monthly%20trend%20by%20borough_ui.jpg)

</details>

<details>
<summary>Total Complaints by Borough</summary>

**Insight:** Bronx leads in total complaints, indicating higher infrastructure pressure, while Staten Island shows minimal activity.

![Total Complaints](screenshots/Storytelling/%20top%20complaint%20descriptors_ui.jpg)

</details>

<details>
<summary>Top Complaint Types</summary>

**Insight:** Most complaints are driven by non-working elevators and lack of backup systems, revealing critical reliability issues across building infrastructure.

![Top Complaints](screenshots/Storytelling/%20top%20complaint%20descriptors_ui.jpg)

</details>

<details>
<summary>Peak Month Detection</summary>

**Insight:** Complaint peaks occur during summer months, while steady activity during winter indicates persistent baseline demand.

![Peak Months](screenshots/Storytelling/Peak%20months%20detection_ui.jpg)

</details>

<details>
<summary>Multi-Borough Comparison</summary>

**Insight:** Higher complaint volumes correlate with urban density and building concentration.

![Comparison](screenshots/Storytelling/Multi-borough%20comparison%20(PORTFOLIO%20GOLD)_ui.jpg)

</details>

<details>
<summary>Top Agencies Handling Requests</summary>

**Insight:** All elevator-related complaints are handled by a single agency (DOB), indicating centralized responsibility but potential operational bottlenecks.

![Top Agencies](screenshots/Storytelling/top%20agencies%20handling%20requests_ui.jpg)

</details>

<details>
<summary>First Aggregation Step</summary>

**Insight:** Initial aggregation confirms consistent monthly complaint distribution and establishes a reliable baseline for further analytical exploration.

![First Aggregation](screenshots/Storytelling/Run%20your%20first%20aggregation_ui.jpg)

</details>

<details>
<summary>Schema Inspection</summary>

**Insight:** Flexible schema with multiple categorical and timestamp fields enables powerful analysis but requires careful type handling and data preparation.

![Schema](screenshots/Storytelling/Inspect%20schema_ui.jpg)

</details>

<details>
<summary>Query Plan Inspection (EXPLAIN)</summary>

**Insight:** The execution plan shows a sequential scan followed by projection and aggregation, illustrating DuckDB's efficient pipeline-based query processing.

![Explain](screenshots/Storytelling/EXPLAIN_ui.jpg)

</details>

<details>
<summary>EXPLAIN ANALYZE — Real Execution Metrics</summary>

**Insight:** Real execution metrics confirm fast query performance, demonstrating DuckDB's efficiency for analytical workloads.

![Explain Analyze](screenshots/Storytelling/EXPLAIN%20ANALYZE%20%E2%80%94%20Real%20Execution_ui.jpg)

</details>

<details>
<summary>Query Optimization</summary>

**Insight:** Optimized queries improve execution clarity and efficiency.

![Optimization](screenshots/Storytelling/Improve%20the%20query%20(VERY%20IMPORTANT)_ui.jpg)

</details>

<details>
<summary>Advanced Analysis</summary>

**Insight:** Advanced analysis reinforces key patterns, emphasizing seasonal peaks and sustained infrastructure pressure throughout the year.

![Advanced Version](screenshots/Storytelling/Advanced%20version%20(%20THIS%20IS%20STRONG)_ui.jpg)

</details>

---

## Stack

| Layer | Technology |
|-------|-----------|
| Analytics Engine | DuckDB (in-process) |
| Cloud Layer | MotherDuck |
| ETL Automation | Python |
| Containerization | Docker + Docker Compose |
| Export Formats | CSV + Parquet |
| Validation | Automated consistency checks |

---

## Credits

- Evgenii Matveev
- Data Analyst | MLOps | Automation

---

## 🙏 Credits & Inspiration

<details>
<summary>Click to expand</summary>

Big thanks to **Andreas Kretz** for the original DuckDB + MotherDuck learning resources 🙌

This project was inspired by his course and helped me better understand modern analytics workflows, DuckDB, and reproducible data pipelines.

### 🔗 Resources

- 📦 Course Repository:  
  https://github.com/andkret/MotherDuck-DuckDB-Course  

- 🧑‍💻 GitHub:  
  https://github.com/andkret  

- 💼 LinkedIn:  
  https://www.linkedin.com/in/andreas-kretz/  

Highly recommend his content if you're learning data engineering 🚀

</details>

Inspired by **Andreas Kretz** and his DuckDB + MotherDuck course.
Original repo: [andkret/MotherDuck-DuckDB-Course](https://github.com/andkret/MotherDuck-DuckDB-Course)

---

## Connect

- GitHub: [evgeniimatveev](https://github.com/evgeniimatveev)
- Portfolio: [datascienceportfol.io/evgeniimatveevusa](https://www.datascienceportfol.io/evgeniimatveevusa)
- LinkedIn: [Evgenii Matveev](https://www.linkedin.com/in/evgenii-matveev-510926276/)
