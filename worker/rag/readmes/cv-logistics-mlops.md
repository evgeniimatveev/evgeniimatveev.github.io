# CV Logistics — Bin Item-Count · MLflow · W&B · PostgreSQL + DuckDB

![CV](https://img.shields.io/badge/Computer_Vision-Logistics-blue)
![MLflow](https://img.shields.io/badge/MLflow-Tracking-orange?logo=mlflow)
![W&B](https://img.shields.io/badge/W%26B-Sweeps-yellow)
![PyTorch](https://img.shields.io/badge/PyTorch-Transfer_Learning-red?logo=pytorch)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Experiments-blue?logo=postgresql)
![DuckDB](https://img.shields.io/badge/DuckDB-Local_Analytics-yellow?logo=duckdb)
![Status](https://img.shields.io/badge/Status-In_Progress-yellow)

## What This Project Does

A warehouse robot photographs a bin and the model predicts how many items are inside it — the same counting problem Amazon Robotics uses to sanity-check inventory without a human opening every bin. Companion project to [mlops_project](https://github.com/evgeniimatveev/mlops_project) (XGBoost/tabular); this one swaps the model for a CNN and the dataset for images, but reuses the exact same tracking stack.

**Dataset:** [Amazon Bin Image Dataset](https://registry.opendata.aws/amazon-bin-imagery/) — a curated ~10,441-image subset (bin counts 1-5), same subset used in the Udacity "Inventory Monitoring at Distribution Centers" capstone. Full ABID is 500k+ images / 50+ GB; this subset is ~450MB, chosen to fit comfortably on this machine's disk and train on CPU or a 2GB-VRAM GPU.

**Task:** 5-class classification (predict count 1-5) via transfer learning on a frozen/fine-tuned MobileNetV2 or ResNet18 backbone.

---

## Architecture

```mermaid
flowchart LR
    subgraph Data
        S3[("S3: aft-vbi-pds\n~10,441 images")] --> DL["download_data"]
        DL --> CD["clean_data\nmanifest + train/val/test split"]
    end

    subgraph Training
        CD --> MT["model_training\nMobileNetV2 / ResNet18"]
    end

    subgraph Tracking
        MT --> MLF[("MLflow\nPostgres backend")]
        MT --> WB[("W&B\ncloud")]
    end

    subgraph Analytics
        MLF --> SQL["Postgres SQL"]
        MLF --> DDB[("DuckDB\nlocal mirror")]
    end

    MT --> API["FastAPI\ninference"]
```

---

## Results

First baseline (`full_run_v1`, frozen MobileNetV2 backbone, 10 epochs): **32.2% val accuracy, 0.95 val MAE**. `train_loss`/`train_accuracy` improved steadily while `val_*` stayed flat and noisy — the classic signature of a linear-probe ceiling: a single trainable layer on top of frozen, generic ImageNet features can only get so far at a task ImageNet was never trained for (guessing item counts in visual clutter, not "what object is this").

![W&B single-run dashboard](docs/screenshots/wandb_full_run_v1.png)

The controlled comparison (`scripts/run_benchmarks.py`, same 5 epochs each, only `unfreeze_layers` + a correspondingly lower learning rate change) confirmed it — monotonic improvement, more of the backbone trainable = better every metric, all the way to full fine-tune. A follow-up 10-trial W&B Bayesian sweep (also varying backbone/batch size/dropout) then beat that entire comparison: **`classic-sweep-4`, ResNet18 with `unfreeze_layers=2`, val MAE 0.755** — better than the controlled full-fine-tune MobileNetV2 result (0.827), and a reminder that architecture choice can matter more than how much of it you unfreeze.

![W&B run comparison overlay, all 4 configs](docs/screenshots/wandb_all_configs_comparison.png)

| Run | Backbone | `unfreeze_layers` | Val accuracy | Val MAE |
|---|---|---|---|---|
| **classic-sweep-4** | ResNet18 | 2 | **41.4%** | **0.755** |
| bench_full | MobileNetV2 | -1 (full) | 37.9% | 0.827 |
| bench_partial4 | MobileNetV2 | 4 | 34.2% | 0.884 |
| full_run_v1 (10 epochs) | MobileNetV2 | 0 (frozen) | 32.2% | 0.949 |

Full table (16 runs: 5 controlled + 10 sweep + 1 extended): [`BENCHMARKS.md`](BENCHMARKS.md) (refresh with `uv run python scripts/generate_benchmarks_md.py`), or query `sql_queries/run_comparison.sql` directly.

Every run above trained only 4-5 epochs, so rankings among them are relative signal, not converged final answers. Resolved with `champion_extended` — reran `classic-sweep-4`'s exact hyperparameters for 15 epochs instead of 4: `val_loss` bottoms out around epoch 5 (1.30) then climbs steadily to 2.17 by epoch 15 while `train_loss` keeps falling the whole time — textbook overfitting on the 8,352-image train split. The original 4-epoch result (0.755 val MAE) was close to the real optimum, not a lucky early stop.

![champion_extended: val_loss diverging from train_loss after epoch 5](docs/screenshots/wandb_champion_extended_overfitting.png)

While investigating this, found and fixed a real bug: `train.py` was logging/registering whichever weights the model held after its *last* epoch, not the checkpoint that actually had the best `val_loss` — identical for runs that keep improving to the end, silently wrong for any run (like this one) that starts overfitting first. Now reloads the best checkpoint before logging, and tracks `best_val_mae` alongside `best_val_loss` so ranking always matches what's actually being served.

Current best model is registered in the MLflow Model Registry as `cv_logistics_bin_count`, promoted to the `champion` alias — `src/model_deployment/app.py` serves whatever version currently holds that alias, no redeploy needed when a better run comes along. Traceable straight back to its source run and logged input/output schema:

![MLflow Model Registry: version 6, champion alias, source run, I/O schema](docs/screenshots/mlflow_model_registry.png)

<details>
<summary><strong>More screenshots</strong> — sweep parallel coordinates, parameter importance</summary>

W&B's Bayesian sweep view, all 10 trials. `unfreeze_layers` and `batch_size` came out as the top two hyperparameters by importance for `val_mae` — `learning_rate` and `dropout` mattered less than expected given how much attention the controlled comparison put into hand-tuning learning rate per config.

![W&B sweep parameter importance](docs/screenshots/wandb_sweep_param_importance.png)

Parallel-coordinates trace of every trial's config against its result:

![W&B sweep parallel coordinates](docs/screenshots/wandb_sweep_parallel_coords.png)

</details>

---

## Why Postgres *and* DuckDB

One MLflow tracking server (shared with `mlops_project`) writes every run to a single Postgres `mlflow_db` — that's the source of truth. `sql_queries/export_to_duckdb.py` pulls this experiment's runs/params/metrics out of Postgres into a local DuckDB file, so you can do fast ad-hoc SQL against experiment history without a live Postgres connection.

```bash
uv run python sql_queries/export_to_duckdb.py
duckdb analytics/mlflow_runs.duckdb -c "select * from runs limit 5"
```

### Best runs by validation MAE (Postgres)

```sql
SELECT
    r.run_uuid, r.name AS run_name,
    COALESCE(
        MAX(CASE WHEN lm.key = 'best_val_mae' THEN lm.value END),
        MAX(CASE WHEN lm.key = 'val_mae' THEN lm.value END)
    ) AS val_mae
FROM runs r
JOIN experiments     e  ON r.experiment_id = e.experiment_id
JOIN latest_metrics   lm ON r.run_uuid      = lm.run_uuid
WHERE e.name = 'cv_logistics_bin_count_v1'
  AND r.lifecycle_stage = 'active'
GROUP BY r.run_uuid, r.name
ORDER BY val_mae ASC
LIMIT 5;
```

(Uses `latest_metrics`, not `metrics` — the raw table has one row per epoch, so ordering by it directly mixes epochs across runs once more than one run exists. Prefers `best_val_mae` — the val_mae at the best-`val_loss` epoch, which is what the registered model's weights actually are — falling back to `val_mae` for runs logged before that fix.)

More in `sql_queries/` — hyperparameter impact, per-experiment run counts, epoch-level learning curves.

---

## Weekly automation

`scripts/weekly_pipeline.py` runs unattended via Windows Task Scheduler (`scripts/register_task.ps1`, every Sunday 09:00): makes sure the MLflow server is up, trains the next not-yet-run config from the comparison (falling back to one W&B sweep trial once all of them are done), appends the result to `results/history.json`, regenerates `BENCHMARKS.md` and the `champion` alias, and `git commit`/`push`es — no manual step after the first setup.

This has to live on the machine itself rather than GitHub Actions: hosted runners can't reach a `localhost` Postgres/MLflow server. `scripts/weekly_pipeline.py --smoke N` runs N lightweight passes on synthetic data (no git writes) to sanity-check the automation before trusting it unattended.

---

## Project Structure

```
cv-logistics-mlops/
├── src/
│   ├── download_data/        # pulls ABID subset from public S3
│   ├── clean_data/           # validates images, builds train/val/test manifest
│   ├── model_training/       # CNN training loop, MLflow + W&B logging
│   ├── model_deployment/     # FastAPI inference endpoint
│   └── utils/                # Dataset + model-factory shared by training & sweeps
├── sql_queries/               # Postgres analytics + Postgres->DuckDB export
├── sweeps/                    # W&B Bayesian sweep (backbone, lr, batch size, dropout)
├── scripts/                   # benchmark runner + BENCHMARKS.md generator
├── config/                    # mlflow_config.yaml, duckdb_config.yaml
├── models/                    # saved checkpoints (gitignored)
├── docs/screenshots/          # README images
└── .github/workflows/         # CI
```

---

## How to Run

```bash
# 1. Environment (uv-managed, Python 3.11)
uv sync

# 2. Start MLflow tracking server (shared Postgres backend — same DB mlops_project uses)
uv run mlflow server \
  --backend-store-uri "postgresql://mlflow_user:mlflow_pass123@localhost/mlflow_db" \
  --default-artifact-root "./mlflow_artifacts_v1" \
  --host 127.0.0.1 --port 5000
# Open http://localhost:5000

# 3. Pipeline
uv run python src/download_data/run.py          # ~10,441 images, ~450MB
uv run python src/clean_data/run.py              # builds data/processed/manifest.csv
uv run python -m src.model_training.run --epochs 8 --backbone mobilenet_v2

# 4. W&B hyperparameter sweep (10 Bayesian runs)
uv run python sweeps/sweep.py

# 4b. Or: fixed frozen/partial/full fine-tune comparison + results table
uv run python scripts/run_benchmarks.py
uv run python scripts/generate_benchmarks_md.py   # refreshes BENCHMARKS.md
uv run python scripts/promote_best_model.py        # moves the "champion" alias if warranted

# 5. Analytics
uv run python sql_queries/export_to_duckdb.py
# then run sql_queries/*.sql against Postgres (DBeaver) or DuckDB directly

# 6. Serve the trained model
uv run uvicorn src.model_deployment.app:app --port 8000
```

---

## Stack

| Layer | Technology |
|-------|-----------|
| Model | PyTorch (MobileNetV2 / ResNet18 transfer learning) |
| Experiment Tracking | MLflow (Postgres backend, shared server) + W&B (cloud) |
| Hyperparameter Tuning | W&B Sweeps (Bayesian) |
| Experiment Analytics | PostgreSQL (source of truth) + DuckDB (local fast queries) |
| Serving | FastAPI |
| CI/CD | GitHub Actions |
| Package management | uv |

---

## Connect

- GitHub: [evgeniimatveev](https://github.com/evgeniimatveev)
- Portfolio: [datascienceportfol.io/evgeniimatveevusa](https://www.datascienceportfol.io/evgeniimatveevusa)
- LinkedIn: [Evgenii Matveev](https://www.linkedin.com/in/evgenii-matveev-510926276/)
