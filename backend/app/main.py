"""FastAPI application exposing datasets, experiments, metrics, the communication ledger and exports."""

from __future__ import annotations

import csv
import io
import json
import os
import uuid
from contextlib import asynccontextmanager
from functools import lru_cache

import numpy as np
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from . import __version__, datasets, engine, partition
from .config import CORS_ORIGINS, FRONTEND_DIST
from .db import Database
from .jobs import JobManager, TooManyJobs
from .schemas import ExperimentConfig, StepRequest, SuiteRequest

state: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = Database()
    interrupted = db.mark_interrupted()
    if interrupted:
        print(f"[fedtraffic] marked {interrupted} unfinished experiment(s) from a previous run as failed")
    state["db"] = db
    state["jobs"] = JobManager(db)
    # Demo mode: on an empty database, queue the evaluation suite so a fresh deployment shows real results.
    if os.environ.get("FEDTRAFFIC_SEED_DEMO", "").lower() in ("1", "true", "yes") and not db.list_experiments(limit=1):
        base = ExperimentConfig(dataset_id="pems04" if datasets.availability(datasets.SPECS["pems04"])[0] else "synthetic",
                                partition="dirichlet", alpha=0.5, rounds=20, seed=42)
        suite_id = uuid.uuid4().hex[:8]
        for label, cfg in preset_configs(base).items():
            if label in ("CENTRAL", "A", "B", "C", "C2", "D"):
                state["jobs"].submit(cfg, suite_id=suite_id, suite_label=label)
        print(f"[fedtraffic] demo mode: queued evaluation suite {suite_id}")
    yield


app = FastAPI(title="FedTraffic API", version=__version__, lifespan=lifespan,
              description="Federated traffic-flow forecasting with communication-cost evaluation (PS-003).")
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(TooManyJobs)
def _too_many(_, exc: TooManyJobs):
    return JSONResponse({"detail": str(exc)}, status_code=429)


def db() -> Database:
    return state["db"]


def jobs() -> JobManager:
    return state["jobs"]


def get_or_404(exp_id: str, include_predictions: bool = False) -> dict:
    exp = db().get_experiment(exp_id, include_predictions)
    if not exp:
        raise HTTPException(404, f"Experiment '{exp_id}' not found")
    return exp


def present(exp: dict) -> dict:
    exp = dict(exp)
    exp["progress"] = exp["current_round"] / exp["total_rounds"] if exp["total_rounds"] else 0
    exp["has_final_metrics"] = exp["status"] == "completed" and bool(exp.get("metrics"))
    exp["is_demo_data"] = False
    exp.pop("idempotency_key", None)
    return exp


# --------------------------------------------------------------------------- health & datasets


@app.get("/api/health")
def health():
    return {"status": "ok", "version": __version__, "environment": engine.environment_info(),
            "running": [k for k, c in jobs().controls.items() if c.started]}


@app.get("/api/datasets")
def get_datasets():
    return datasets.list_datasets()


@app.get("/api/datasets/{dataset_id}")
def get_dataset(dataset_id: str):
    for d in datasets.list_datasets():
        if d["id"] == dataset_id:
            return d
    raise HTTPException(404, f"Dataset '{dataset_id}' not found")


def _load_or_400(dataset_id: str) -> datasets.TrafficDataset:
    try:
        return datasets.load_dataset(dataset_id)
    except KeyError:
        raise HTTPException(404, f"Dataset '{dataset_id}' not found")
    except FileNotFoundError as e:
        raise HTTPException(400, str(e))


@app.get("/api/datasets/{dataset_id}/series")
def dataset_series(dataset_id: str, sensor: int = 0, target: str = "flow", start: int = 0, length: int = Query(576, ge=1, le=20000)):
    ds = _load_or_400(dataset_id)
    if target not in ds.spec.features:
        raise HTTPException(400, f"Target '{target}' not in {ds.spec.features}")
    if not 0 <= sensor < ds.num_sensors:
        raise HTTPException(400, f"sensor must be in [0, {ds.num_sensors - 1}]")
    start = max(0, min(start, ds.num_steps - 1))
    end = min(ds.num_steps, start + length)
    vals = ds.values[start:end, sensor, ds.feature_index(target)]
    return {"dataset_id": dataset_id, "sensor": sensor, "target": target, "unit": ds.spec.units[target],
            "timestamps": [ds.timestamp(t).isoformat() for t in range(start, end)], "values": [round(float(v), 3) for v in vals]}


@lru_cache(maxsize=64)
def _partition_preview(dataset_id, target, num_sensors, num_clients, strategy, alpha, seed, train_frac, val_frac):
    ds = datasets.load_dataset(dataset_id)
    splits = datasets.chronological_splits(ds.num_steps, train_frac, val_frac)
    sensors = partition.select_sensors(ds.num_sensors, num_sensors, seed)
    series = datasets.SensorSeries(ds, target, sensors, splits)
    columns = list(range(len(sensors)))
    groups = partition.partition(columns, series.mean, num_clients, strategy, alpha, seed)
    het = partition.heterogeneity(groups, columns, series.mean)
    bins = partition.profile_bins(series.mean)
    a, b = splits.train
    steps_per_day = 24 * 60 // ds.spec.interval_minutes
    hour = ((np.arange(a, b) % steps_per_day) * ds.spec.interval_minutes // 60).astype(int)
    clients = []
    for k, cols in enumerate(groups):
        vals = series.raw[a:b, cols]
        mask = vals > 0
        hourly = []
        for h in range(24):
            sel = vals[hour == h]
            m = sel[sel > 0]
            hourly.append(round(float(m.mean()), 3) if m.size else None)
        pos = vals[mask]
        clients.append({
            "client_id": k,
            "name": f"Client {engine.client_label(k)}",
            "sensors": [int(sensors[i]) for i in cols],
            "num_sensors": len(cols),
            "train_records": int(vals.size),
            "train_windows": len(cols) * max(0, (b - a) - 12 - 12 + 1),
            "missing_fraction": float(1 - mask.mean()) if vals.size else 0.0,
            "mean": float(pos.mean()) if pos.size else 0.0,
            "std": float(pos.std()) if pos.size else 0.0,
            "p95": float(np.percentile(pos, 95)) if pos.size else 0.0,
            "hourly_profile": hourly,
            "level_histogram": np.bincount(bins[cols], minlength=partition.NUM_PROFILE_BINS).tolist(),
            "heterogeneity_tv": het["per_client"][k],
            "raw_training_bytes": datasets.raw_record_bytes(ds, [sensors[i] for i in cols], splits.train),
        })
    return {"dataset_id": dataset_id, "target": target, "unit": ds.spec.units[target], "partition": strategy,
            "alpha": alpha if strategy == "dirichlet" else None, "seed": seed, "heterogeneity": het, "clients": clients,
            "level_bins_definition": "sensors grouped into 5 quantile bins of mean training-period value (0 = lowest traffic)",
            "splits": splits.describe(ds)}


@app.get("/api/datasets/{dataset_id}/partition-preview")
def partition_preview(dataset_id: str, target: str = "flow", num_sensors: int = Query(50, ge=2), num_clients: int = Query(5, ge=2, le=50),
                      partition_strategy: str = Query("dirichlet", alias="partition"), alpha: float = Query(0.5, gt=0), seed: int = 42,
                      train_frac: float = 0.7, val_frac: float = 0.15):
    ds = _load_or_400(dataset_id)
    if target not in ds.spec.features:
        raise HTTPException(400, f"Target '{target}' not in {ds.spec.features}")
    if partition_strategy not in ("contiguous", "iid", "dirichlet"):
        raise HTTPException(400, "partition must be contiguous, iid or dirichlet")
    num_sensors = min(num_sensors, ds.num_sensors)
    if num_clients > num_sensors:
        raise HTTPException(400, "num_clients cannot exceed num_sensors")
    return _partition_preview(dataset_id, target, num_sensors, num_clients, partition_strategy, round(alpha, 4), seed, train_frac, val_frac)


# --------------------------------------------------------------------------- experiments


PRESET_INFO = {
    "CENTRAL": ("Centralized baseline", "Raw training records uploaded once; one model trained centrally with matched gradient steps."),
    "A": ("A. FedAvg baseline (fp32)", "Baseline federated configuration with uncompressed fp32 updates."),
    "B": ("B. Reduced communication frequency", "Half the rounds with twice the local epochs (same local compute)."),
    "C": ("C. INT8 update compression", "Uplink updates quantised to 8 bits per value."),
    "C2": ("C2. Top-k sparsification (5%)", "Only the largest 5% of update values are sent, with error feedback."),
    "D": ("D. Partial participation (60%)", "60% of clients are sampled each round."),
    "PROX": ("FedProx (mu=0.01)", "FedAvg aggregation with a proximal term in the local objective."),
}


def preset_configs(base: ExperimentConfig) -> dict[str, ExperimentConfig]:
    b = base.model_dump(exclude={"name", "start_paused"})
    b["mode"] = "federated"
    fed = {**b, "uplink_encoding": "fp32", "downlink_encoding": "fp32", "client_fraction": 1.0, "aggregation": "fedavg"}
    return {
        "CENTRAL": ExperimentConfig(**{**fed, "mode": "centralized", "name": PRESET_INFO["CENTRAL"][0]}),
        "A": ExperimentConfig(**{**fed, "name": PRESET_INFO["A"][0]}),
        "B": ExperimentConfig(**{**fed, "rounds": max(1, b["rounds"] // 2), "local_epochs": b["local_epochs"] * 2, "name": PRESET_INFO["B"][0]}),
        "C": ExperimentConfig(**{**fed, "uplink_encoding": "int8", "name": PRESET_INFO["C"][0]}),
        "C2": ExperimentConfig(**{**fed, "uplink_encoding": "topk", "topk_ratio": 0.05, "error_feedback": True, "name": PRESET_INFO["C2"][0]}),
        "D": ExperimentConfig(**{**fed, "client_fraction": 0.6, "name": PRESET_INFO["D"][0]}),
        "PROX": ExperimentConfig(**{**fed, "aggregation": "fedprox", "prox_mu": 0.01, "name": PRESET_INFO["PROX"][0]}),
    }


@app.get("/api/presets")
def presets():
    base = ExperimentConfig()
    cfgs = preset_configs(base)
    return {"defaults": base.model_dump(), "presets": [{"id": k, "title": PRESET_INFO[k][0], "description": PRESET_INFO[k][1], "config": v.model_dump()} for k, v in cfgs.items()]}


@app.get("/api/experiments")
def list_experiments(status: str | None = None, limit: int = Query(200, ge=1, le=1000)):
    return [present(e) for e in db().list_experiments(status, limit)]


@app.post("/api/experiments", status_code=201)
def create_experiment(cfg: ExperimentConfig, idempotency_key: str | None = Header(None, alias="Idempotency-Key")):
    exp, created = jobs().submit(cfg, idempotency_key=idempotency_key)
    return JSONResponse(present(exp), status_code=201 if created else 200)


@app.post("/api/suites", status_code=201)
def create_suite(req: SuiteRequest, idempotency_key: str | None = Header(None, alias="Idempotency-Key")):
    cfgs = preset_configs(req.base)
    suite_id = uuid.uuid4().hex[:8]
    out = []
    for label in dict.fromkeys(req.include):
        key = f"{idempotency_key}:{label}" if idempotency_key else None
        exp, _ = jobs().submit(cfgs[label], idempotency_key=key, suite_id=suite_id, suite_label=label)
        out.append(present(exp))
    return {"suite_id": suite_id, "experiments": out}


@app.get("/api/experiments/{exp_id}")
def get_experiment(exp_id: str):
    return present(get_or_404(exp_id))


@app.delete("/api/experiments/{exp_id}", status_code=204)
def delete_experiment(exp_id: str):
    exp = get_or_404(exp_id)
    if exp["status"] in ("queued", "running"):
        raise HTTPException(409, "Cancel the experiment before deleting it")
    db().delete_experiment(exp_id)
    return Response(status_code=204)


def _control_or_409(exp_id: str):
    get_or_404(exp_id)
    ctl = jobs().control(exp_id)
    if not ctl:
        raise HTTPException(409, "Experiment is not active (already finished, failed or cancelled)")
    return ctl


@app.post("/api/experiments/{exp_id}/pause")
def pause(exp_id: str):
    _control_or_409(exp_id).pause()
    return present(get_or_404(exp_id))


@app.post("/api/experiments/{exp_id}/resume")
def resume(exp_id: str):
    _control_or_409(exp_id).resume()
    return present(get_or_404(exp_id))


@app.post("/api/experiments/{exp_id}/step")
def step(exp_id: str, req: StepRequest | None = None):
    _control_or_409(exp_id).step((req or StepRequest()).count)
    return present(get_or_404(exp_id))


@app.post("/api/experiments/{exp_id}/cancel")
def cancel(exp_id: str):
    _control_or_409(exp_id).cancel()
    return present(get_or_404(exp_id))


@app.get("/api/experiments/{exp_id}/rounds")
def rounds(exp_id: str, since: int = 0):
    get_or_404(exp_id)
    return db().get_rounds(exp_id, since)


@app.get("/api/experiments/{exp_id}/events")
def events(exp_id: str, after: int = 0, limit: int = Query(500, ge=1, le=5000)):
    get_or_404(exp_id)
    return db().get_events(exp_id, after, limit)


@app.get("/api/experiments/{exp_id}/metrics")
def metrics(exp_id: str):
    exp = get_or_404(exp_id)
    rds = db().get_rounds(exp_id)
    last = rds[-1] if rds else None
    return {
        "experiment_id": exp_id,
        "status": exp["status"],
        "final": exp["status"] == "completed",
        "note": None if exp["status"] == "completed" else "Experiment has not completed: only per-round validation metrics are available; test metrics are computed at the end.",
        "test": exp.get("metrics"),
        "latest_round": last,
        "completed_rounds": exp["completed_rounds"],
        "end_to_end_runtime_seconds": exp.get("end_to_end_runtime_seconds"),
        "summary": exp.get("summary"),
        "config": exp["config"],
    }


def _communication(exp: dict) -> dict:
    ledger = db().get_ledger(exp["id"])
    rds = db().get_rounds(exp["id"])
    up = sum(r["upload_bytes"] for r in ledger)
    down = sum(r["download_bytes"] for r in ledger)
    m = exp.get("metrics") or {}
    totals = {"upload_bytes": up, "download_bytes": down, "total_bytes": up + down,
              "raw_upload_bytes": sum(r["raw_upload_bytes"] for r in ledger),
              "completed_rounds": exp["completed_rounds"], "ledger_entries": len(ledger)}
    consistent = None if not m else (m.get("total_communication_bytes") == up + down)
    summary = exp.get("summary") or {}
    return {"experiment_id": exp["id"], "status": exp["status"], "accounting": summary.get("communication_accounting"),
            "totals": totals, "ledger_matches_reported_totals": consistent,
            "rounds": [{k: r.get(k) for k in ("round", "status", "participants", "successful_clients", "upload_bytes", "download_bytes", "total_bytes", "raw_upload_bytes", "cumulative_bytes", "elapsed_s", "duration_s", "est_transfer_s")} for r in rds],
            "ledger": ledger}


@app.get("/api/experiments/{exp_id}/communication")
def communication(exp_id: str):
    return _communication(get_or_404(exp_id))


@app.get("/api/experiments/{exp_id}/predictions")
def predictions(exp_id: str, client_id: int | None = None):
    exp = get_or_404(exp_id, include_predictions=True)
    if exp["status"] != "completed":
        return {"experiment_id": exp_id, "status": exp["status"], "available": False, "traces": [],
                "note": "Predictions are produced from the selected checkpoint after the experiment completes."}
    traces = exp.get("predictions") or []
    if client_id is not None:
        traces = [t for t in traces if t.get("client_id") == client_id]
    s = exp.get("summary") or {}
    return {"experiment_id": exp_id, "status": exp["status"], "available": True, "unit": (exp.get("metrics") or {}).get("unit"),
            "target": exp["config"]["target"], "horizon_steps": exp["config"]["horizon"], "interval_minutes": (s.get("dataset") or {}).get("interval_minutes"),
            "split": "test", "checkpoint_round": (exp.get("metrics") or {}).get("selected_round"), "traces": traces}


def _csv(rows: list[dict], fields: list[str] | None = None) -> str:
    buf = io.StringIO()
    if not rows:
        return ""
    fields = fields or list(dict.fromkeys(k for r in rows for k in r))
    w = csv.DictWriter(buf, fieldnames=fields, extrasaction="ignore")
    w.writeheader()
    for r in rows:
        w.writerow({k: (json.dumps(v) if isinstance(v, (list, dict)) else v) for k, v in r.items()})
    return buf.getvalue()


@app.get("/api/experiments/{exp_id}/export")
def export(exp_id: str, format: str = Query("json", pattern="^(json|csv)$"), table: str = Query("rounds", pattern="^(rounds|ledger|predictions|summary)$")):
    exp = get_or_404(exp_id, include_predictions=True)
    if format == "json":
        body = {"experiment": present({k: v for k, v in exp.items() if k != "predictions"}), "rounds": db().get_rounds(exp_id),
                "communication": _communication(exp), "predictions": exp.get("predictions"), "events": db().get_events(exp_id, 0, 5000)}
        return Response(json.dumps(body, indent=2), media_type="application/json",
                        headers={"Content-Disposition": f'attachment; filename="experiment_{exp_id}.json"'})
    if table == "rounds":
        rows = db().get_rounds(exp_id)
    elif table == "ledger":
        rows = db().get_ledger(exp_id)
    elif table == "summary":
        m = exp.get("metrics") or {}
        rows = [{"experiment_id": exp_id, "name": exp["name"], "status": exp["status"], **{k: v for k, v in m.items() if not isinstance(v, (list, dict))}}]
    else:
        rows = []
        for t in exp.get("predictions") or []:
            for i, ts in enumerate(t.get("timestamps", [])):
                row = {"client_id": t["client_id"], "sensor_index": t["sensor_index"], "timestamp": ts, "actual": t["actual"][i], "missing": t["missing"][i]}
                for h, vals in t["predicted_by_step"].items():
                    row[f"predicted_step_{h}"] = vals[i]
                rows.append(row)
    return Response(_csv(rows), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="experiment_{exp_id}_{table}.csv"'})


# --------------------------------------------------------------------------- comparison

COMPAT_KEYS = {
    "dataset_id": "dataset", "target": "prediction target", "input_len": "input window", "horizon": "forecast horizon",
    "num_sensors": "number of sensors", "train_frac": "train split", "val_frac": "validation split",
    "seed": "seed (selects the sensor subset, so the test set differs)",
}


def _compare(ids: list[str], baseline: str | None) -> dict:
    exps = [get_or_404(i) for i in ids]
    base = next((e for e in exps if e["id"] == baseline), exps[0])
    issues = []
    for e in exps:
        if e["status"] != "completed":
            issues.append({"experiment_id": e["id"], "severity": "error", "message": f"'{e['name']}' is {e['status']}; it has no final test metrics."})
        for k, label in COMPAT_KEYS.items():
            if e["config"][k] != base["config"][k]:
                issues.append({"experiment_id": e["id"], "severity": "error", "message": f"'{e['name']}' uses a different {label} ({e['config'][k]} vs {base['config'][k]})."})
    bm = base.get("metrics") or {}
    rows = []
    for e in exps:
        m = e.get("metrics") or {}
        c = e["config"]
        row = {
            "experiment_id": e["id"], "name": e["name"], "status": e["status"], "mode": e["mode"], "is_baseline": e["id"] == base["id"],
            "model": (e.get("summary") or {}).get("model", {}).get("name", "GRUForecaster"), "dataset": c["dataset_id"], "target": c["target"],
            "horizon_minutes": c["horizon"] * datasets.SPECS[c["dataset_id"]].interval_minutes,
            "mae": m.get("mae"), "rmse": m.get("rmse"), "mape": m.get("mape"),
            "total_communication_bytes": m.get("total_communication_bytes"), "upload_bytes": m.get("total_upload_bytes"), "download_bytes": m.get("total_download_bytes"),
            "communication_rounds": m.get("completed_rounds", e["completed_rounds"]),
            "runtime_seconds": e.get("end_to_end_runtime_seconds"), "training_time_seconds": m.get("training_time_seconds"),
            "config_summary": {k: c[k] for k in ("mode", "num_clients", "partition", "alpha", "rounds", "local_epochs", "client_fraction", "aggregation", "uplink_encoding", "topk_ratio", "downlink_encoding", "seed")},
        }
        if bm and m and e["id"] != base["id"]:
            bb, eb = bm.get("total_communication_bytes"), m.get("total_communication_bytes")
            row["communication_reduction_pct_vs_baseline"] = (1 - eb / bb) * 100 if bb else None
            row["mae_change_pct_vs_baseline"] = (m["mae"] / bm["mae"] - 1) * 100 if bm.get("mae") else None
            row["rmse_change_pct_vs_baseline"] = (m["rmse"] / bm["rmse"] - 1) * 100 if bm.get("rmse") else None
        rows.append(row)
    return {"baseline_id": base["id"], "comparable": not any(i["severity"] == "error" for i in issues), "issues": issues, "rows": rows,
            "note": "Lower communication is not automatically a better result: read communication change together with the change in MAE/RMSE."}


@app.get("/api/compare")
def compare(ids: str = Query(..., description="Comma-separated experiment ids"), baseline: str | None = None, format: str = Query("json", pattern="^(json|csv)$")):
    id_list = [i for i in ids.split(",") if i]
    if len(id_list) < 2:
        raise HTTPException(400, "Provide at least two experiment ids")
    result = _compare(id_list, baseline)
    if format == "csv":
        rows = [{**{k: v for k, v in r.items() if k != "config_summary"}, **{f"cfg_{k}": v for k, v in r["config_summary"].items()}} for r in result["rows"]]
        return Response(_csv(rows), media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="comparison.csv"'})
    return result


# --------------------------------------------------------------------------- frontend (production build)

if FRONTEND_DIST.exists() and (FRONTEND_DIST / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(404)
        f = FRONTEND_DIST / path
        if path and f.is_file() and FRONTEND_DIST in f.resolve().parents:
            return FileResponse(f)
        return FileResponse(FRONTEND_DIST / "index.html")
