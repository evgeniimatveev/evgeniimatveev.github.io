# Business SQL Analytics — PostgreSQL · Python · Tableau · Excel

![SQL](https://img.shields.io/badge/SQL-PostgreSQL-blue?logo=postgresql&logoColor=white)
![Python](https://img.shields.io/badge/Python-Automation-yellow?logo=python&logoColor=black)
![Tableau](https://img.shields.io/badge/Tableau-Visualization-orange?logo=tableau&logoColor=white)
![Excel](https://img.shields.io/badge/Excel-Reports-green?logo=microsoftexcel&logoColor=white)
![CI/CD](https://img.shields.io/badge/GitHub_Actions-CI%2FCD-black?logo=githubactions&logoColor=white)
![Status](https://img.shields.io/badge/Status-Active-brightgreen)

---

## What This Project Does

End-to-end business analytics pipeline built on a simulated retail dataset: **customers, orders, products, and transactions** across 4 normalized tables.

**26+ SQL queries** organized from data validation → aggregations → transaction analysis → multi-table joins, with Python automation for data generation and Tableau dashboards for stakeholder reporting.

 **Pipeline:** `PostgreSQL → SQL Analytics → Python Export → Tableau + Excel`

 **Dataset:** 2,314 customers · 5,000 transactions · $2.58M revenue · 14 months

---

  ## Business Questions & Findings

  | Question | Finding |
  |----------|---------|
  | Who are the top 10 customers by revenue? | Top customer: **$5,133** total spend · avg customer **$1,115** |
  | Which payment methods dominate? | Across **5,000 transactions**, avg ticket **$515.85** |
  | What is the monthly revenue trend? | Peak month: **$240,920** (446 orders) · low: **$79,918** |
  | Which product categories drive most sales? | **$2,579,272** total revenue across all categories |
  | Returning vs one-time customers? | **59.8% returning** (1,384 of 2,314) vs 40.2% one-time |

---

## SQL — Advanced Patterns

### Window Function: Customer Revenue Ranking

```sql
SELECT
    c.customer_name,
    SUM(t.amount)                                               AS total_spent,
    RANK() OVER (ORDER BY SUM(t.amount) DESC)                  AS revenue_rank,
    ROUND(SUM(t.amount) / SUM(SUM(t.amount)) OVER () * 100, 1) AS pct_of_total
FROM customers c
JOIN transactions t ON c.customer_id = t.customer_id
GROUP BY c.customer_name
ORDER BY revenue_rank;
```

### CTE: Monthly Revenue with Month-over-Month Change

```sql
WITH monthly_revenue AS (
    SELECT
        DATE_TRUNC('month', transaction_date) AS month,
        SUM(amount)                           AS revenue,
        COUNT(DISTINCT customer_id)           AS active_customers
    FROM transactions
    GROUP BY 1
)
SELECT
    month,
    revenue,
    active_customers,
    ROUND(revenue - LAG(revenue) OVER (ORDER BY month), 0) AS mom_change
FROM monthly_revenue
ORDER BY month;
```

### Multi-Table JOIN: Full Customer Order Profile

```sql
SELECT
    c.customer_name,
    COUNT(DISTINCT o.order_id)  AS total_orders,
    SUM(t.amount)               AS total_spent,
    ROUND(AVG(t.amount), 2)    AS avg_transaction,
    MAX(t.transaction_date)     AS last_purchase
FROM customers c
JOIN orders o       ON c.customer_id = o.customer_id
JOIN transactions t ON o.order_id    = t.order_id
GROUP BY c.customer_name
ORDER BY total_spent DESC
LIMIT 10;
```

---

## Project Structure

```
mlops_sql_project/
├── sql/
│   ├── ddl/                    # schema, tables, constraints
│   ├── dml/                    # data inserts & resets
│   └── dql/
│       ├── a_checks/           # data validation (nulls, FK, indexes)
│       ├── b_aggregations/     # counts, min/max, category stats
│       ├── c_transactions/     # order & payment analysis
│       └── d_joins/            # multi-table joins, top customers
├── python/
│   ├── generate_customers.py
│   ├── generate_orders.py
│   ├── generate_products.py
│   ├── generate_transactions.py
│   ├── sales_summary.py
│   └── customer_behavior.py
├── Tableau/
│   ├── sales_dashboard.twb
│   ├── transaction_analysis.twb
│   └── customer_insights.twb
├── excel/
│   ├── sales_summary.xlsx
│   ├── transactions_overview.xlsx
│   └── customer_behavior.xlsx
└── env/                        # DB config, logging, settings
```

---

## Architecture

```
PostgreSQL (4 tables: customers, orders, products, transactions)
    └── SQL layer: DDL → DML → DQL (26+ queries)
            └── Python automation (data generation + export)
                    ├── Tableau dashboards (sales, transactions, customers)
                    └── Excel reports (summary exports)
```

---

## How to Run

```bash
# 1. Clone and set up environment
git clone https://github.com/evgeniimatveev/business-sql-analytics.git
cd business-sql-analytics
conda env create -f environment.yaml
conda activate mlops_env

# 2. Configure DB credentials
cp env/.env.example env/.env

# 3. Generate synthetic data
python python/generate_customers.py
python python/generate_orders.py
python python/generate_products.py
python python/generate_transactions.py

# 4. Run SQL analytics
# Open sql/dql/ queries in DBeaver or psql
```

---

## Stack

| Layer | Technology |
|-------|-----------|
| Database | PostgreSQL |
| Analytics | SQL (CTEs, Window Functions, Multi-table JOINs) |
| Automation | Python (Faker, pandas, psycopg2) |
| Visualization | Tableau |
| Reporting | Excel |
| CI/CD | GitHub Actions |

---

## Connect

- GitHub: [evgeniimatveev](https://github.com/evgeniimatveev)
- Portfolio: [datascienceportfol.io/evgeniimatveevusa](https://www.datascienceportfol.io/evgeniimatveevusa)
- LinkedIn: [Evgenii Matveev](https://www.linkedin.com/in/evgenii-matveev-510926276/)
