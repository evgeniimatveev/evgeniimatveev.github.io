# Snowflake A-Z

Hands-on Snowflake practice covering SQL fundamentals, data ingestion, disaster-recovery mechanics, automation (Streams/Tasks and Dynamic Tables), access control, the Python DataFrame API (Snowpark), query performance tuning, and cost/usage monitoring - built during a 30-day Snowflake trial.

![Snowflake](https://img.shields.io/badge/Snowflake-29B5E8?style=for-the-badge&logo=snowflake&logoColor=white)
![SQL](https://img.shields.io/badge/SQL-336791?style=for-the-badge&logo=postgresql&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Streamlit](https://img.shields.io/badge/Streamlit-FF4B4B?style=for-the-badge&logo=streamlit&logoColor=white)

## Why this repo has no live demo

This was a deliberate 30-day / $400-credit Snowflake trial used purely to learn the platform - not a production account kept running indefinitely. Every script here was executed for real against a live Snowflake account and verified before being committed. Once the trial period ends the account is not renewed, so there is no persistent hosted dashboard to link to - the code and the verified results (including the screenshots below) captured along the way are the proof of work.

## What's covered

<!-- PRACTICES_TABLE:START -->
| # | File | Topic | Verified result |
|---|------|-------|------------------|
| 1 | [`1st_Practice.sql`](1st_Practice.sql) | SQL basics: filter, join, aggregate, CTE, window functions | 7 queries against TPCH_SF1 sample data (customer/orders/nation) |
| 2 | [`2nd_Practice_S3_Ingestion.sql`](2nd_Practice_S3_Ingestion.sql) | External stage + `COPY INTO` from S3, semi-structured data (`VARIANT`, `LATERAL FLATTEN`) | 100 rows loaded from a public S3 bucket, 0 errors |
| 3 | [`3rd_Practice_TimeTravel_Clone.sql`](3rd_Practice_TimeTravel_Clone.sql) | Time Travel, DROP + UNDROP, zero-copy clone | Restored deleted rows via `AT(OFFSET)`, undropped a table, proved clone independence (90 vs 100 rows) |
| 4 | [`4th_Practice_CSV_Upload.sql`](4th_Practice_CSV_Upload.sql) | Local CSV upload wizard (UI path, not `COPY INTO`) | 3,745 real rows loaded from a personal Uber-trips dataset |
| 5 | [`5th_Practice_Streamlit_Capstone.py`](5th_Practice_Streamlit_Capstone.py) | Native Streamlit-in-Snowflake app build/deploy process | Interactive dashboard built and deployed (see below) |
| 6 | [`6th_Practice_Streams_Tasks.sql`](6th_Practice_Streams_Tasks.sql) | Streams (CDC) + Tasks (scheduled/triggered automation) | Stream captured 2 inserted rows, a task moved them into a change log, stream drained to 0 |
| 7 | [`7th_Practice_RBAC.sql`](7th_Practice_RBAC.sql) | Role-based access control, least privilege | Custom read-only role: `SELECT` succeeded, `INSERT` correctly rejected |
| 8 | [`8th_Practice_Snowpark.py`](8th_Practice_Snowpark.py) | Snowpark: Python DataFrame API (filter/group_by/agg, window functions, lazy query plans) | Same rollup + top-3-per-city ranking as practice 1, expressed as chained DataFrame calls instead of SQL text; `.queries` used to confirm the generated SQL is pushed down, not computed client-side |
| 9 | [`9th_Practice_QueryProfile_Performance.sql`](9th_Practice_QueryProfile_Performance.sql) | Query Profile (operator tree, bytes/partitions scanned), warehouse sizing, partition pruning | X-Small -> Small on the same 14M-row `CROSS JOIN`: 864ms -> 117ms (~7.4x); confirmed a ~3.7k-row table lives in a single micro-partition, so no `WHERE` clause can reduce partitions scanned |
| 10 | [`10th_Practice_Cost_Monitoring.sql`](10th_Practice_Cost_Monitoring.sql) | Cost & usage monitoring: `WAREHOUSE_METERING_HISTORY`, resource monitors via `SHOW` + `RESULT_SCAN`, `ACCOUNT_USAGE.QUERY_HISTORY` | Verified the Day-1 `LEARNING_MONITOR` guardrails (50 credit quota, notify/suspend at 50%/75%/100%) are still active at 2.13 of 50 credits used |
| 11 | [`11th_Practice_Dynamic_Tables.sql`](11th_Practice_Dynamic_Tables.sql) | Dynamic Tables: declarative, incrementally-refreshed pipelines (alternative to Streams + Tasks) | Inserted + deleted a test city; the automatic background refresh (TARGET_LAG=1 minute) had already applied both changes before a manual REFRESH ran, reporting "No new data". Refresh history showed 96.6% NO_DATA / 3.4% INCREMENTAL across 88 checks. |
<!-- PRACTICES_TABLE:END -->

The table above is generated from [`practices.json`](practices.json) by [`scripts/generate_readme_table.py`](scripts/generate_readme_table.py), auto-run by a GitHub Action on every push that touches `practices.json` - add a new practice by editing the JSON, not the markdown.

The Streamlit dashboard's actual application code lives in [`streamlit_app/streamlit_app.py`](streamlit_app/streamlit_app.py).

## Architecture

```mermaid
flowchart LR
    A[("driver_lifetime_trips.csv")] -->|"Upload wizard<br/>Practice 4"| B[("driver_lifetime_trips<br/>table")]
    B --> C{{"Stream<br/>trips_stream<br/>Practice 6"}}
    C --> D["Task<br/>log_trip_changes_task"]
    D --> E[("trips_change_log<br/>table")]
    B --> F["TRIPS_ANALYST_ROLE<br/>SELECT-only<br/>Practice 7"]
    B --> G["Streamlit App<br/>Practice 5"]
    G --> H(["Interactive dashboard"])
    B --> I["Snowpark DataFrame API<br/>Practice 8"]
    I --> J(["Python-native queries<br/>(same engine, no SQL text)"])
    B --> K["Query Profile & Warehouse Sizing<br/>Practice 9"]
    K --> L(["7.4x speedup: X-Small -> Small"])
    B --> M["Cost & Usage Monitoring<br/>Practice 10"]
    M --> N(["WAREHOUSE_METERING_HISTORY +<br/>Resource Monitor verified via SQL"])
    B --> O["Dynamic Table<br/>Practice 11"]
    O --> P(["Auto-refresh beat a manual REFRESH to the punch"])
```

## Dashboard

Built on `driver_lifetime_trips` (3,745 rows, loaded in practice 4): a city filter drives three KPI metrics and two bar charts, backed entirely by `st.connection("snowflake").session().sql(...)` - no external database, no separate auth.

<p align="center">
  <img src="screenshots/dashboard_metrics.png" width="700" alt="Dashboard header and KPI metrics" />
</p>

- **All cities:** 3,745 trips · $71,508.53 total fare · 11.52 mi avg distance
- **Filtered to Los Angeles:** 2,155 trips · $42,547.87 · 8.08 mi
- **Filtered to Ventura:** 6 trips · $82.48 · 5.63 mi

<p align="center">
  <img src="screenshots/dashboard_trips_by_city.png" width="46%" alt="Trips by city bar chart" />
  <img src="screenshots/dashboard_fare_by_city.png" width="46%" alt="Total fare by city bar chart" />
</p>

<p align="center">
  <img src="screenshots/dashboard_underlying_data.png" width="700" alt="Underlying data table" />
</p>

## Cost & Performance Monitoring (Practices 9-10)

Real numbers pulled with SQL, not just read off the Snowsight screen.

<p align="center">
  <img src="screenshots/resource_monitor.png" width="700" alt="LEARNING_MONITOR resource monitor queried via SHOW + RESULT_SCAN" />
</p>

The Day-1 `LEARNING_MONITOR` guardrails, read back with `SHOW RESOURCE MONITORS` + `RESULT_SCAN(LAST_QUERY_ID())`: 50-credit quota, notify/suspend/suspend-immediately at 50%/75%/100%, 2.13 of 50 credits used after about a week of practices.

<p align="center">
  <img src="screenshots/warehouse_credits_daily.png" width="700" alt="Daily credit burn per warehouse from WAREHOUSE_METERING_HISTORY" />
</p>

Daily credit burn per warehouse from `SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY` - the real cost ground truth behind the resource monitor above.

<p align="center">
  <img src="screenshots/top_expensive_queries.png" width="700" alt="Top queries by elapsed time from ACCOUNT_USAGE.QUERY_HISTORY" />
</p>

Top-10 queries by `total_elapsed_time` from `ACCOUNT_USAGE.QUERY_HISTORY` - and the honest finding from practice 10: the longest-running entries are `CALL`/`EXECUTE_STREAMLIT` sessions with `0` bytes and `0` partitions scanned. They dominate an elapsed-time ranking just by sitting open (idle container/browser tab), not by doing real compute work - elapsed time is a poor proxy for cost; the credits chart above is the real signal.

## Stack

- Snowflake (Standard Edition, AWS us-east-2)
- SQL (Snowflake dialect)
- Python + Snowpark + Streamlit (native Streamlit-in-Snowflake)
- pandas

## Naming convention

Files are numbered in the order they were completed, each following the same lecture format: a header banner explaining the goal, a `SETUP` block restoring session context, lettered `PART` sections with a "Use case" explanation before every query, and a `RECAP` at the end summarizing the takeaways.

---

## CI

[![Lint](https://github.com/evgeniimatveev/Snowflake-A-Z/actions/workflows/lint.yml/badge.svg)](https://github.com/evgeniimatveev/Snowflake-A-Z/actions/workflows/lint.yml) — SQL parse-check (SQLFluff, Snowflake dialect) + Python syntax check on every push.
[![Sync README](https://github.com/evgeniimatveev/Snowflake-A-Z/actions/workflows/sync-readme.yml/badge.svg)](https://github.com/evgeniimatveev/Snowflake-A-Z/actions/workflows/sync-readme.yml) — practices table auto-generated from `practices.json`.
