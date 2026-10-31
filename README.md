# AIORI-3-HACKATHON-PROJECTS

[![Live demo](https://img.shields.io/badge/Live%20demo-aiorirepo.vercel.app-000?logo=vercel)](https://aiorirepo.vercel.app/)

**Live demo: [https://aiorirepo.vercel.app/](https://aiorirepo.vercel.app/)** (FedTraffic dashboard and backend API)

This repository contains the code and resources for the AIORI-3 hackathon project developed during AIORI-3.

YouTube video link: [Watch here on YouTube](https://youtu.be/3Stu3cYr3Lk?si=CVSLCMdG_vJ2UxFM)

Documents: [Project write-up](<Federated Traffic-Flow Prediction Project.pdf>) • [Proposed structure](Proposed-structure-hackathon.pdf)

---

# FedTraffic — Federated Traffic-Flow Prediction with Communication-Cost Evaluation

RuminateX • AIORI Hackathon 3 • PS-003

A web dashboard (React + Vite) backed by a Python API (FastAPI + PyTorch) that:

- trains a compact GRU traffic forecaster with **FedAvg / FedProx** across simulated roadside clients, each owning a disjoint group of real sensors;
- trains the same model **centrally** on pooled data as a baseline;
- records the **exact serialized size** of every model broadcast and client update in a per-round, per-client ledger;
- supports communication optimizations: fewer rounds, **fp16 / int8 / top-k** update compression, **partial participation**, simulated client dropouts;
- evaluates on a **chronological** held-out test split (MAE, RMSE, MAPE) and stores every experiment (config, rounds, ledger, events, predictions) in SQLite.

Every number in the dashboard comes from a stored experiment. Nothing is pre-filled.

## Project layout

```
frontend/   React + Vite dashboard (src/, public/, package.json, vite.config.ts)
backend/    FastAPI + PyTorch API (app/, tests/, data/, requirements.txt, run.sh)
```

## Quick start

```bash
# 1. Backend (first run creates backend/.venv, installs deps, downloads PeMS04 ~32 MB)
cd backend
./run.sh                 # http://127.0.0.1:8000  (API docs: /docs)

# 2. Frontend (separate terminal)
cd frontend
npm install
npm run dev              # http://localhost:3000  (proxies /api to :8000)
```

Then open the dashboard and either press **Run** on *Federated Simulator*, or go to *Experiments & Compare* → **Run suite** to execute the PRD evaluation plan (centralized baseline + experiments A–D).

Single-server mode: `cd frontend && npm run build`, then `./backend/run.sh` also serves the built dashboard from `frontend/dist/` at http://127.0.0.1:8000.

## Deploy on Render

The repo contains a `Dockerfile` (builds the dashboard, bundles PeMS04, serves everything from one URL) and a `render.yaml` Blueprint.

1. Render Dashboard → **New → Blueprint** → pick this GitHub repo → **Apply**. Render builds the Dockerfile (~5–10 min).
2. Open `https://<service>.onrender.com`. With `FEDTRAFFIC_SEED_DEMO=1` the evaluation suite runs on first start (~3 min), so results appear without clicking anything.

Manual alternative: **New → Web Service** → this repo → Runtime **Docker** → Health check path `/api/health` → add the variables from [`backend/.env.example`](backend/.env.example).

- **Plan:** use **Standard (2 GB)** or larger. Tested with 1 CPU: peak memory 838 MB; the 512 MB Free/Starter plans run out of memory during training.
- **History:** Render's filesystem resets on each deploy/restart. To keep experiments, attach a disk at `/var/data` and set `FEDTRAFFIC_DB_PATH=/var/data/fedtraffic.db`.
- **No secrets** are needed. All backend settings are listed in [`backend/.env.example`](backend/.env.example).

## Pages

| Page | Shows |
|---|---|
| Problem & Overview | Purpose, live status of the active experiment |
| Federated Simulator | Run / pause / step real FedAvg rounds; client weights, losses, validation curve, test forecasts, backend event log |
| Centralized vs FedAvg | Paired runs across seeds 42/108/999 (mean ± std), per-horizon error, forecast overlay, bandwidth what-if |
| Client Non-IID Telemetry | Real partition statistics per client (daily profiles, traffic-level mix, TV-distance heterogeneity) |
| Communication & Cost | Ledger (per round / per client), encoding comparison, MAE-vs-bytes scatter, LaTeX/CSV export |
| Experiments & Compare | Full configuration form, presets/suites, history, cancel/delete, comparison with compatibility checks, CSV/JSON export |
| Methodology & Sources | Protocol, accounting rules, datasets, limitations, references |

## API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Backend status and software versions |
| GET | `/api/datasets` | Datasets, availability, features/units, period |
| GET | `/api/datasets/{id}/partition-preview` | Per-client statistics for a partition config |
| GET | `/api/datasets/{id}/series` | Raw series for one sensor |
| GET | `/api/presets` | Default config and PRD experiment presets |
| GET / POST | `/api/experiments` | List / create (optional `Idempotency-Key` header prevents duplicates) |
| POST | `/api/suites` | Queue several presets sharing one base config |
| GET / DELETE | `/api/experiments/{id}` | Status + metadata / delete |
| POST | `/api/experiments/{id}/pause\|resume\|step\|cancel` | Round-level control |
| GET | `/api/experiments/{id}/rounds` | Per-round validation metrics and bytes |
| GET | `/api/experiments/{id}/metrics` | Final test metrics (only when completed) |
| GET | `/api/experiments/{id}/communication` | Ledger, totals, consistency check |
| GET | `/api/experiments/{id}/predictions` | Actual vs predicted on the test split |
| GET | `/api/experiments/{id}/events` | Event log |
| GET | `/api/experiments/{id}/export?format=json\|csv&table=rounds\|ledger\|predictions\|summary` | Export |
| GET | `/api/compare?ids=a,b&baseline=a[&format=csv]` | Comparison with compatibility issues |

Interactive docs: http://127.0.0.1:8000/docs

## Method summary

- **Data:** PeMS04 (307 sensors, 5-min, flow/occupancy/speed, Jan–Feb 2018). `num_sensors` are sampled by seed. A clearly labelled synthetic dataset exists for testing; METR-LA is supported if `backend/data/metr-la.h5` and `pip install tables` are present.
- **Splits:** chronological 70/15/15; windows never cross boundaries; zeros are treated as missing.
- **Model:** GRU(hidden 64) + MLP head, 12 input steps → 12 output steps (60 min ahead), per-sensor z-score with training-period statistics.
- **Federation:** each client trains locally (Adam, masked L1), uploads Δ = local − global; the server applies the n_k/N-weighted mean of received updates. A round where no update arrives is marked failed and not counted as completed.
- **Selection & test:** the round with the best validation MAE is evaluated once on the test split.
- **Accounting:** bytes = length of each serialized payload (header + tensors); network protocol overhead is excluded; transfer times are estimates from configured bandwidth. Centralized cost = float32 size of all raw training records.

## Tests

```bash
cd backend && .venv/bin/python -m pytest -q
```

## Limitations

Clients are simulated in one process. The forecaster is per-sensor (no spatial graph). Keeping data local is not a formal privacy guarantee (no secure aggregation / differential privacy).
# ruminatex


link to our working website : https://aiorirepo.vercel.app/
