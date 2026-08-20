# Data Pipeline ETL — Python · PostgreSQL · Docker · GitHub Actions

![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-blue?logo=postgresql)
![Docker](https://img.shields.io/badge/Docker-Containerized-blue?logo=docker)
![SQLFluff](https://img.shields.io/badge/SQLFluff-Linting-purple)
![CI/CD](https://img.shields.io/badge/GitHub_Actions-CI%2FCD-black?logo=githubactions)
![Status](https://img.shields.io/badge/Status-Active-brightgreen)

---

## What This Project Does

Lightweight but production-structured ETL pipeline: generates synthetic sales data with Faker, transforms it in Python, loads into PostgreSQL — all containerized with Docker and validated via automated SQL linting on every push.

**Pipeline:** `Faker → sales.csv → ETL (Python) → PostgreSQL → SQL Analytics → CI/CD (SQLFluff)`

**What makes it stand out:** SQLFluff linting runs automatically on every push via GitHub Actions — SQL formatting is enforced the same way code style is in real engineering teams.

---

## ETL Flow

```
generate_data.py  →  sales.csv  →  etl.py  →  PostgreSQL (sales table)
                                                      ↓
                                              sql/dql/ queries
                                                      ↓
                                         GitHub Actions (sqlfluff lint)
```

---

## SQL Queries — From the Repo

### Top 5 Categories by Revenue

```sql
SELECT
    category,
    COUNT(*)                        AS total_orders,
    ROUND(SUM(total)::numeric, 2)  AS revenue
FROM sales
GROUP BY category
ORDER BY revenue DESC
LIMIT 5;
```

### Weekly Sales Trend

```sql
SELECT
    DATE_TRUNC('week', date::date)  AS week_start,
    COUNT(*)                         AS total_orders,
    ROUND(SUM(total)::numeric, 2)   AS total_revenue
FROM sales
GROUP BY week_start
ORDER BY week_start;
```

### CTE + Window Function: Category Revenue Ranking

```sql
WITH category_revenue AS (
    SELECT
        category,
        COUNT(*)                        AS total_orders,
        ROUND(SUM(total)::numeric, 2)  AS revenue
    FROM sales
    GROUP BY category
)
SELECT
    category,
    total_orders,
    revenue,
    RANK() OVER (ORDER BY revenue DESC)              AS rank,
    ROUND(revenue / SUM(revenue) OVER () * 100, 1)  AS pct_of_total
FROM category_revenue
ORDER BY rank;
```

---

## CI/CD — SQL Linting with SQLFluff

Every push and pull request triggers:

```bash
sqlfluff lint sql/dql --dialect postgres
```

SQL formatting is automatically validated — same engineering standard used in production data teams.

---

## Project Structure

```
data-pipeline-etl-project/
├── scripts/
│   ├── etl.py                # Extract → Transform → Load
│   ├── generate_data.py      # Synthetic sales data (Faker)
│   └── clean_sql_files.py    # Auto-fix SQL formatting
├── sql/
│   └── dql/
│       ├── top_categories.sql
│       ├── sales_by_region.sql
│       ├── discount_impact.sql
│       ├── daily_sales_trend.sql
│       └── weekly_sales_trend.sql
├── data/
│   └── raw/sales.csv
├── .github/workflows/
│   └── sql-lint.yaml         # SQLFluff CI/CD workflow
├── docker-compose.yaml
├── Dockerfile
└── requirements.txt
```

---

## How to Run

```bash
# 1. Clone the repo
git clone https://github.com/evgeniimatveev/data-pipeline-etl-project.git
cd data-pipeline-etl-project

# 2. Start containers and run ETL
docker-compose up --build
# Output: Data successfully loaded into the 'sales' table.

# 3. Run SQL queries in DBeaver or psql
# Connect to localhost:5432, database: sales_db
```

---

## Stack

| Layer | Technology |
|-------|-----------|
| Data Generation | Python (Faker) |
| ETL Logic | Python (pandas, psycopg2) |
| Database | PostgreSQL |
| Containerization | Docker + Docker Compose |
| SQL Quality | SQLFluff (automated linting) |
| CI/CD | GitHub Actions |

---

## Connect

- GitHub: [evgeniimatveev](https://github.com/evgeniimatveev)
- Portfolio: [datascienceportfol.io/evgeniimatveevusa](https://www.datascienceportfol.io/evgeniimatveevusa)
- LinkedIn: [Evgenii Matveev](https://www.linkedin.com/in/evgenii-matveev-510926276/)
