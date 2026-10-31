"""Experiment execution: federated (FedAvg / FedProx) and centralized training of the GRU forecaster.

Federated data flow per round:
  server --(encoded global weights)--> sampled clients
  client trains on its own windows, sends an encoded *update* (local - received weights)
  server decodes updates and aggregates them weighted by local training-window counts.
Raw sensor readings are never part of any federated payload.
"""

from __future__ import annotations

import math
import platform
import time
from dataclasses import dataclass, field
from typing import Callable, Protocol

import numpy as np
import torch

from . import compression, datasets, partition
from .model import GRUForecaster, count_parameters, get_weights, set_weights
from .schemas import ExperimentConfig

PREDICTION_POINTS = 576  # two days at 5-minute resolution
EVAL_BATCH = 8192


class Cancelled(Exception):
    pass


class Control(Protocol):
    def gate(self, round_number: int) -> None: ...  # blocks while paused, raises Cancelled
    def log(self, prefix: str, text: str, level: str = "info") -> None: ...
    def on_setup(self, summary: dict) -> None: ...
    def on_round(self, record: dict, ledger: list[dict]) -> None: ...
    def compute_slot(self): ...  # context manager limiting concurrent CPU work


# --------------------------------------------------------------------------- metrics


@dataclass
class ErrorSums:
    """Additive error statistics so clients can report evaluation results without sharing data."""

    horizon: int
    abs_sum: np.ndarray = None
    sq_sum: np.ndarray = None
    ape_sum: np.ndarray = None
    count: np.ndarray = None

    def __post_init__(self):
        z = lambda: np.zeros(self.horizon, dtype=np.float64)  # noqa: E731
        self.abs_sum, self.sq_sum, self.ape_sum, self.count = z(), z(), z(), z()

    def add(self, pred: np.ndarray, actual: np.ndarray):
        mask = actual > 0  # zero readings are treated as missing
        err = np.where(mask, pred - actual, 0.0)
        self.abs_sum += np.abs(err).sum(0)
        self.sq_sum += (err**2).sum(0)
        self.ape_sum += np.where(mask, np.abs(err) / np.where(mask, actual, 1.0), 0.0).sum(0)
        self.count += mask.sum(0)

    def merge(self, other: "ErrorSums"):
        self.abs_sum += other.abs_sum
        self.sq_sum += other.sq_sum
        self.ape_sum += other.ape_sum
        self.count += other.count

    def summary(self) -> dict:
        n = np.maximum(self.count, 1)
        mae_h = self.abs_sum / n
        rmse_h = np.sqrt(self.sq_sum / n)
        total = max(self.count.sum(), 1)
        return {
            "mae": float(self.abs_sum.sum() / total),
            "rmse": float(math.sqrt(self.sq_sum.sum() / total)),
            "mape": float(self.ape_sum.sum() / total * 100),
            "mae_at_horizon": float(mae_h[-1]),
            "rmse_at_horizon": float(rmse_h[-1]),
            "mae_per_step": [float(v) for v in mae_h],
            "rmse_per_step": [float(v) for v in rmse_h],
            "observations": int(self.count.sum()),
        }


@torch.no_grad()
def evaluate(model: GRUForecaster, windows: datasets.WindowSet, horizon: int) -> ErrorSums:
    model.eval()
    sums = ErrorSums(horizon)
    n = len(windows)
    for a in range(0, n, EVAL_BATCH):
        rows = np.arange(a, min(n, a + EVAL_BATCH))
        x, _, y_raw, mean, std, _ = windows.batch(rows)
        pred = model(torch.from_numpy(x)).numpy() * std + mean
        sums.add(pred, y_raw)
    return sums


def train_steps(model, opt, windows: datasets.WindowSet, steps: int, batch_size: int, rng: np.random.Generator, prox_ref=None, prox_mu=0.0) -> float:
    """Run `steps` mini-batches of masked-L1 training. Returns mean loss (normalised units)."""
    model.train()
    n = len(windows)
    need = steps * batch_size
    order = rng.permutation(n)[:need] if n >= need else rng.integers(0, n, need)
    losses = []
    for i in range(steps):
        rows = order[i * batch_size : (i + 1) * batch_size]
        x, y, y_raw, *_ = windows.batch(rows)
        x_t, y_t = torch.from_numpy(x), torch.from_numpy(y)
        mask = torch.from_numpy((y_raw > 0).astype(np.float32))
        pred = model(x_t)
        loss = (torch.abs(pred - y_t) * mask).sum() / mask.sum().clamp(min=1.0)
        if prox_ref is not None and prox_mu > 0:
            prox = sum(((p - r) ** 2).sum() for p, r in zip(model.parameters(), prox_ref))
            loss = loss + 0.5 * prox_mu * prox
        opt.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 5.0)
        opt.step()
        losses.append(float(loss.item()))
    return float(np.mean(losses)) if losses else 0.0


@torch.no_grad()
def prediction_trace(model, series: datasets.SensorSeries, column: int, test_split: tuple[int, int], cfg: ExperimentConfig) -> dict:
    """Actual vs predicted values on the test period for one sensor, aligned by target timestamp."""
    model.eval()
    L, H = cfg.input_len, cfg.horizon
    s0 = test_split[0]
    max_points = test_split[1] - s0 - L - H + 1 - (H - 1)
    n = max(0, min(PREDICTION_POINTS, max_points))
    if n == 0:
        return {}
    starts = np.arange(s0, s0 + n + H - 1)
    ws = datasets.WindowSet(series, np.full(len(starts), column), starts, L, H)
    x, _, _, mean, std, _ = ws.batch(np.arange(len(starts)))
    P = model(torch.from_numpy(x)).numpy() * std + mean  # (len(starts), H)
    tau = np.arange(s0 + L + H - 1, s0 + L + H - 1 + n)
    preds = {}
    for h in range(1, H + 1):
        idx = tau - L - h + 1 - s0
        preds[str(h)] = [round(float(v), 3) for v in P[idx, h - 1]]
    actual = series.raw[tau, column]
    ds = series.ds
    return {
        "sensor_index": int(series.sensors[column]),
        "timestamps": [ds.timestamp(int(t)).isoformat() for t in tau],
        "actual": [round(float(v), 3) for v in actual],
        "missing": [bool(v <= 0) for v in actual],
        "predicted_by_step": preds,
    }


def trace_column(series: datasets.SensorSeries, columns: list[int], test_split: tuple[int, int]) -> int:
    """Sensor shown in prediction charts: the one with the fewest missing readings early in the test period."""
    a = test_split[0]
    window = series.raw[a : a + PREDICTION_POINTS + 48, columns]
    return columns[int(np.argmin((window <= 0).sum(axis=0)))]


def environment_info() -> dict:
    return {
        "python": platform.python_version(),
        "torch": torch.__version__,
        "numpy": np.__version__,
        "platform": platform.platform(),
        "torch_threads": torch.get_num_threads(),
    }


# --------------------------------------------------------------------------- setup


def client_label(k: int) -> str:
    return chr(65 + k) if k < 26 else str(k + 1)


@dataclass
class ClientData:
    client_id: int
    columns: list[int]
    train: datasets.WindowSet
    val: datasets.WindowSet
    test: datasets.WindowSet
    raw_bytes: int
    residual: dict | None = None
    info: dict = field(default_factory=dict)


def _prepare(cfg: ExperimentConfig):
    ds = datasets.load_dataset(cfg.dataset_id)
    splits = datasets.chronological_splits(ds.num_steps, cfg.train_frac, cfg.val_frac)
    sensors = partition.select_sensors(ds.num_sensors, cfg.num_sensors, cfg.seed)
    series = datasets.SensorSeries(ds, cfg.target, sensors, splits)
    columns = list(range(len(sensors)))
    return ds, splits, sensors, series, columns


def _transfer_seconds(nbytes: int, kbps: float) -> float:
    return nbytes * 8 / (kbps * 1000)


def _new_model(cfg: ExperimentConfig, input_size: int) -> GRUForecaster:
    torch.manual_seed(cfg.seed)
    return GRUForecaster(input_size, cfg.hidden_size, cfg.horizon)


def _base_summary(cfg, ds, splits, sensors, model) -> dict:
    return {
        "dataset": {
            "id": ds.spec.id,
            "name": ds.spec.name,
            "source": ds.spec.source,
            "sha256": ds.sha256,
            "is_synthetic": ds.spec.is_synthetic,
            "interval_minutes": ds.spec.interval_minutes,
            "target": cfg.target,
            "unit": ds.spec.units[cfg.target],
            "sensors_used": sensors,
            "splits": splits.describe(ds),
            "preprocessing": [
                "Zero readings are treated as missing: excluded from normalisation statistics, the training loss and all metrics.",
                "Per-sensor z-score normalisation using that sensor's training-period values only.",
                "Inputs: target history plus time-of-day (sin/cos) and weekend flag.",
                f"Windows: {cfg.input_len} input steps -> {cfg.horizon} output steps; windows never cross split boundaries.",
            ],
        },
        "model": {
            "name": "GRUForecaster",
            "description": f"1-layer GRU (hidden {cfg.hidden_size}) + 2-layer MLP head predicting {cfg.horizon} steps",
            "parameters": count_parameters(model),
            "fp32_bytes": compression.raw_size(get_weights(model)),
            "loss": "masked L1 on normalised values",
            "optimizer": f"Adam(lr={cfg.learning_rate})",
        },
        "evaluation": {
            "validation": f"every round on validation windows (stride {cfg.eval_stride})",
            "test": "all test windows (stride 1), evaluated once using the checkpoint with the best validation MAE",
            "metrics": "MAE/RMSE/MAPE averaged over all forecast steps; *_at_horizon uses the last step only",
            "selection": "best validation MAE round",
        },
        "communication_accounting": {
            "method": "serialized_payload",
            "description": (
                "Bytes = length of the serialised payload (FTP1 header + tensor data) for each message. "
                "Network-protocol overhead (TCP/IP, TLS, HTTP) is not included. Evaluation reports "
                "(a few aggregate numbers per client) are not counted."
            ),
            "estimated_transfer_time": f"bytes x 8 / bandwidth (uplink {cfg.uplink_kbps} kbps, downlink {cfg.downlink_kbps} kbps); an estimate, not measured",
        },
        "environment": environment_info(),
    }


# --------------------------------------------------------------------------- federated


def run_federated(cfg: ExperimentConfig, ctl: Control) -> dict:
    with ctl.compute_slot():
        ds, splits, sensors, series, columns = _prepare(cfg)
        groups = partition.partition(columns, series.mean, cfg.num_clients, cfg.partition, cfg.alpha, cfg.seed)
        het = partition.heterogeneity(groups, columns, series.mean)
        clients: list[ClientData] = []
        for k, cols in enumerate(groups):
            c = ClientData(
                client_id=k,
                columns=cols,
                train=datasets.make_windows(series, cols, splits.train, cfg.input_len, cfg.horizon),
                val=datasets.make_windows(series, cols, splits.val, cfg.input_len, cfg.horizon, cfg.eval_stride),
                test=datasets.make_windows(series, cols, splits.test, cfg.input_len, cfg.horizon),
                raw_bytes=datasets.raw_record_bytes(ds, [sensors[i] for i in cols], splits.train),
            )
            vals = series.raw[splits.train[0] : splits.train[1], cols]
            pos = vals[vals > 0]
            c.info = {
                "client_id": k,
                "name": f"Client {client_label(k)}",
                "label": client_label(k),
                "sensors": [int(sensors[i]) for i in cols],
                "num_sensors": len(cols),
                "train_windows": len(c.train),
                "val_windows": len(c.val),
                "test_windows": len(c.test),
                "mean_target": float(pos.mean()) if pos.size else 0.0,
                "std_target": float(pos.std()) if pos.size else 0.0,
                "raw_training_bytes_kept_local": c.raw_bytes,
                "heterogeneity_tv": het["per_client"][k],
            }
            clients.append(c)
        total_train = sum(len(c.train) for c in clients)
        for c in clients:
            c.info["fedavg_weight"] = len(c.train) / total_train

        model = _new_model(cfg, series.num_input_features)
        global_w = get_weights(model)
        summary = _base_summary(cfg, ds, splits, sensors, model)
        summary["federation"] = {
            "clients": [c.info for c in clients],
            "partition": cfg.partition,
            "alpha": cfg.alpha if cfg.partition == "dirichlet" else None,
            "heterogeneity": het,
            "aggregation": cfg.aggregation,
            "weighting": "n_k / sum(n) over successful participants, n_k = local training windows",
            "uplink_encoding": cfg.uplink_encoding,
            "downlink_encoding": cfg.downlink_encoding,
            "uplink_payload": "model update (local weights - received global weights)",
            "downlink_payload": "full global model weights",
            "raw_training_bytes_total": sum(c.raw_bytes for c in clients),
        }
        ctl.on_setup(summary)

    ctl.log("SERVER", f"Dataset {ds.spec.id} | target={cfg.target} | {len(sensors)} sensors | {cfg.num_clients} clients ({cfg.partition}) | model {summary['model']['parameters']:,} params ({summary['model']['fp32_bytes']:,} B fp32)", "server")
    for c in clients:
        ctl.log(f"NODE-{c.info['label']}", f"{c.info['num_sensors']} sensors, {len(c.train):,} training windows, FedAvg weight {c.info['fedavg_weight']:.3f}", "node")

    rng = np.random.default_rng(cfg.seed)
    m = max(1, int(round(cfg.client_fraction * cfg.num_clients)))
    best = {"mae": float("inf"), "round": 0, "weights": global_w}
    training_time = 0.0
    completed = 0
    cum_bytes = 0
    t_start = None  # set when the first round actually starts (excludes queue/pause waiting before it)
    totals = {"upload": 0, "download": 0, "raw_upload": 0}

    for r in range(1, cfg.rounds + 1):
        ctl.gate(r)
        with ctl.compute_slot():
            round_t0 = time.perf_counter()
            if t_start is None:
                t_start = round_t0
            participants = sorted(int(i) for i in rng.choice(cfg.num_clients, size=m, replace=False))
            down_payload = compression.encode(global_w, cfg.downlink_encoding)
            received = compression.decode(down_payload)
            ctl.log(f"ROUND-{r}", f"Broadcast global model ({len(down_payload):,} B, {cfg.downlink_encoding}) to clients {[clients[k].info['name'] for k in participants]}", "accent")

            updates, ledger = [], []
            for k in participants:
                c = clients[k]
                t0 = time.perf_counter()
                set_weights(model, received)
                opt = torch.optim.Adam(model.parameters(), lr=cfg.learning_rate)
                prox_ref = [p.detach().clone() for p in model.parameters()] if cfg.aggregation == "fedprox" else None
                losses = [
                    train_steps(model, opt, c.train, min(cfg.max_local_steps, math.ceil(len(c.train) / cfg.batch_size)), cfg.batch_size, rng, prox_ref, cfg.prox_mu)
                    for _ in range(cfg.local_epochs)
                ]
                local_w = get_weights(model)
                delta = {n: local_w[n] - received[n] for n in local_w}
                if cfg.uplink_encoding == "topk" and cfg.error_feedback:
                    if c.residual is None:
                        c.residual = {n: np.zeros_like(v) for n, v in delta.items()}
                    delta = {n: delta[n] + c.residual[n] for n in delta}
                train_s = time.perf_counter() - t0
                training_time += train_s

                dropped = cfg.client_dropout_prob > 0 and rng.random() < cfg.client_dropout_prob
                row = {
                    "round": r,
                    "client_id": k,
                    "client_name": c.info["name"],
                    "download_bytes": len(down_payload),
                    "raw_download_bytes": compression.raw_size(global_w),
                    "local_samples": len(c.train),
                    "local_train_loss": losses[-1],
                    "train_time_s": train_s,
                    "transfer_type": "serialized_payload",
                    "uplink_encoding": cfg.uplink_encoding,
                    "downlink_encoding": cfg.downlink_encoding,
                }
                if dropped:
                    row.update(upload_bytes=0, raw_upload_bytes=0, status="dropped")
                    ctl.log(f"NODE-{c.info['label']}", f"Went offline before uploading (simulated dropout). Update discarded.", "warning")
                else:
                    up_payload = compression.encode(delta, cfg.uplink_encoding, cfg.topk_ratio)
                    decoded = compression.decode(up_payload)
                    if cfg.uplink_encoding == "topk" and cfg.error_feedback:
                        c.residual = {n: delta[n] - decoded[n] for n in delta}
                    updates.append((len(c.train), decoded))
                    row.update(upload_bytes=len(up_payload), raw_upload_bytes=compression.raw_size(delta), status="ok")
                    ctl.log(
                        f"NODE-{c.info['label']}",
                        f"{cfg.local_epochs} local epoch(s), loss {losses[-1]:.4f}, uploaded {len(up_payload):,} B ({cfg.uplink_encoding}) in est. {_transfer_seconds(len(up_payload), cfg.uplink_kbps) * 1000:.0f} ms",
                        "node",
                    )
                row["est_transfer_s"] = _transfer_seconds(row["download_bytes"], cfg.downlink_kbps) + _transfer_seconds(row["upload_bytes"], cfg.uplink_kbps)
                ledger.append(row)

            up = sum(x["upload_bytes"] for x in ledger)
            down = sum(x["download_bytes"] for x in ledger)
            raw_up = sum(x["raw_upload_bytes"] for x in ledger)
            totals["upload"] += up
            totals["download"] += down
            totals["raw_upload"] += raw_up
            cum_bytes += up + down

            if updates:
                t0 = time.perf_counter()
                n_total = sum(n for n, _ in updates)
                global_w = {name: received[name] + sum((n / n_total) * u[name] for n, u in updates) for name in received}
                training_time += time.perf_counter() - t0
                completed += 1
                status = "completed" if len(updates) == len(participants) else "partial"
                ctl.log("SERVER", f"{cfg.aggregation.upper()}: aggregated {len(updates)}/{len(participants)} updates (weights n_k/N over {n_total:,} windows)", "server")
            else:
                status = "failed"
                ctl.log("SERVER", f"Round {r} failed: no client updates received. Global model unchanged; round not counted as completed.", "error")

            set_weights(model, global_w)
            val = ErrorSums(cfg.horizon)
            for c in clients:
                val.merge(evaluate(model, c.val, cfg.horizon))
            vs = val.summary()
            if status != "failed" and vs["mae"] < best["mae"]:
                best = {"mae": vs["mae"], "round": r, "weights": {k2: v.copy() for k2, v in global_w.items()}}

            ok_rows = [x for x in ledger if x["status"] == "ok"]
            record = {
                "round": r,
                "status": status,
                "participants": [x["client_id"] for x in ledger],
                "successful_clients": [x["client_id"] for x in ok_rows],
                "upload_bytes": up,
                "download_bytes": down,
                "total_bytes": up + down,
                "raw_upload_bytes": raw_up,
                "cumulative_bytes": cum_bytes,
                "val_mae": vs["mae"],
                "val_rmse": vs["rmse"],
                "val_mape": vs["mape"],
                "train_loss": float(np.mean([x["local_train_loss"] for x in ok_rows])) if ok_rows else None,
                "client_losses": {str(x["client_id"]): x["local_train_loss"] for x in ledger},
                "duration_s": time.perf_counter() - round_t0,
                "elapsed_s": time.perf_counter() - t_start,
                "est_transfer_s": max((x["est_transfer_s"] for x in ledger), default=0.0),
                "completed_rounds": completed,
            }
            ctl.on_round(record, ledger)
            ctl.log("FEDAVG-OK" if status != "failed" else "FEDAVG-FAIL", f"Round {r} {status}: val MAE {vs['mae']:.3f} / RMSE {vs['rmse']:.3f} {summary['dataset']['unit']} | {up + down:,} B this round, {cum_bytes:,} B total", "success" if status != "failed" else "error")

    with ctl.compute_slot():
        set_weights(model, best["weights"])
        test = ErrorSums(cfg.horizon)
        per_client = []
        for c in clients:
            s = evaluate(model, c.test, cfg.horizon)
            test.merge(s)
            per_client.append({"client_id": c.client_id, "name": c.info["name"], **{k2: v for k2, v in s.summary().items() if k2 in ("mae", "rmse", "mape", "mae_at_horizon", "observations")}})
        predictions = [prediction_trace(model, series, trace_column(series, c.columns, splits.test), splits.test, cfg) | {"client_id": c.client_id, "client_name": c.info["name"]} for c in clients]
        set_weights(model, global_w)
        final = ErrorSums(cfg.horizon)
        for c in clients:
            final.merge(evaluate(model, c.test, cfg.horizon))

    ts = test.summary()
    metrics = {
        **ts,
        "selected_round": best["round"],
        "final_round_test": {k2: v for k2, v in final.summary().items() if k2 in ("mae", "rmse", "mape")},
        "per_client_test": per_client,
        "total_upload_bytes": totals["upload"],
        "total_download_bytes": totals["download"],
        "total_communication_bytes": totals["upload"] + totals["download"],
        "raw_upload_bytes_fp32_equivalent": totals["raw_upload"],
        "uplink_compression_ratio": (totals["raw_upload"] / totals["upload"]) if totals["upload"] else None,
        "raw_training_bytes_kept_local": summary["federation"]["raw_training_bytes_total"],
        "completed_rounds": completed,
        "attempted_rounds": cfg.rounds,
        "training_time_seconds": training_time,
        "horizon_steps": cfg.horizon,
        "horizon_minutes": cfg.horizon * ds.spec.interval_minutes,
        "unit": summary["dataset"]["unit"],
    }
    ctl.log("SERVER", f"Test (round {best['round']} checkpoint): MAE {ts['mae']:.3f}, RMSE {ts['rmse']:.3f}, MAPE {ts['mape']:.2f}% | total {metrics['total_communication_bytes']:,} B over {completed} completed rounds", "success")
    return {"metrics": metrics, "predictions": predictions}


# --------------------------------------------------------------------------- centralized


def run_centralized(cfg: ExperimentConfig, ctl: Control) -> dict:
    with ctl.compute_slot():
        ds, splits, sensors, series, columns = _prepare(cfg)
        # Same sensor groups as the federated run with this config, so the data owners match.
        groups = partition.partition(columns, series.mean, cfg.num_clients, cfg.partition, cfg.alpha, cfg.seed)
        train = datasets.make_windows(series, columns, splits.train, cfg.input_len, cfg.horizon)
        val = datasets.make_windows(series, columns, splits.val, cfg.input_len, cfg.horizon, cfg.eval_stride)
        test = datasets.make_windows(series, columns, splits.test, cfg.input_len, cfg.horizon)
        model = _new_model(cfg, series.num_input_features)
        summary = _base_summary(cfg, ds, splits, sensors, model)
        m = max(1, int(round(cfg.client_fraction * cfg.num_clients)))
        steps_per_round = m * cfg.local_epochs * cfg.max_local_steps
        owners = []
        for k, cols in enumerate(groups):
            owners.append({"client_id": k, "name": f"Client {client_label(k)}", "sensors": [int(sensors[i]) for i in cols], "raw_bytes": datasets.raw_record_bytes(ds, [sensors[i] for i in cols], splits.train)})
        raw_total = sum(o["raw_bytes"] for o in owners)
        summary["centralized"] = {
            "description": "All raw training records are uploaded once to a central server, which trains a single model.",
            "steps_per_round": steps_per_round,
            "compute_matching": "gradient steps per evaluation epoch = sampled clients x local epochs x max local steps of the matching federated config",
            "data_owners": owners,
            "raw_upload_bytes": raw_total,
            "raw_upload_definition": "float32 bytes of every dataset feature for every training-period record of the selected sensors",
        }
        summary["communication_accounting"]["method"] = "serialized_raw_records"
        ctl.on_setup(summary)

    ctl.log("SERVER", f"Centralized baseline: {len(sensors)} sensors, {len(train):,} pooled training windows, model {summary['model']['parameters']:,} params", "server")
    ledger0 = [
        {"round": 0, "client_id": o["client_id"], "client_name": o["name"], "upload_bytes": o["raw_bytes"], "raw_upload_bytes": o["raw_bytes"], "download_bytes": 0, "raw_download_bytes": 0,
         "local_samples": 0, "local_train_loss": None, "train_time_s": 0.0, "transfer_type": "raw_records", "uplink_encoding": "raw_fp32", "downlink_encoding": None, "status": "ok",
         "est_transfer_s": _transfer_seconds(o["raw_bytes"], cfg.uplink_kbps)}
        for o in owners
    ]
    ctl.log("ROUND-0", f"Data owners upload raw training records: {raw_total:,} B (est. {_transfer_seconds(raw_total, cfg.uplink_kbps):.0f} s at {cfg.uplink_kbps} kbps)", "accent")

    rng = np.random.default_rng(cfg.seed)
    opt = torch.optim.Adam(model.parameters(), lr=cfg.learning_rate)
    best = {"mae": float("inf"), "round": 0, "weights": get_weights(model)}
    training_time = 0.0
    t_start = None
    for r in range(1, cfg.rounds + 1):
        ctl.gate(r)
        with ctl.compute_slot():
            t0 = time.perf_counter()
            if t_start is None:
                t_start = t0
            loss = train_steps(model, opt, train, steps_per_round, cfg.batch_size, rng)
            training_time += time.perf_counter() - t0
            vs = evaluate(model, val, cfg.horizon).summary()
            if vs["mae"] < best["mae"]:
                best = {"mae": vs["mae"], "round": r, "weights": get_weights(model)}
            record = {
                "round": r, "status": "completed", "participants": [], "successful_clients": [],
                "upload_bytes": raw_total if r == 1 else 0, "download_bytes": 0, "total_bytes": raw_total if r == 1 else 0,
                "raw_upload_bytes": raw_total if r == 1 else 0, "cumulative_bytes": raw_total,
                "val_mae": vs["mae"], "val_rmse": vs["rmse"], "val_mape": vs["mape"], "train_loss": loss, "client_losses": {},
                "duration_s": time.perf_counter() - t0, "elapsed_s": time.perf_counter() - t_start, "est_transfer_s": 0.0, "completed_rounds": r,
            }
            ctl.on_round(record, ledger0 if r == 1 else [])
            ctl.log("CENTRAL", f"Epoch {r}: train loss {loss:.4f}, val MAE {vs['mae']:.3f} / RMSE {vs['rmse']:.3f}", "success")

    with ctl.compute_slot():
        set_weights(model, best["weights"])
        ts = evaluate(model, test, cfg.horizon).summary()
        predictions = [prediction_trace(model, series, trace_column(series, cols, splits.test), splits.test, cfg) | {"client_id": k, "client_name": f"Client {client_label(k)}"} for k, cols in enumerate(groups)]

    metrics = {
        **ts,
        "selected_round": best["round"],
        "per_client_test": [],
        "total_upload_bytes": raw_total,
        "total_download_bytes": 0,
        "total_communication_bytes": raw_total,
        "raw_upload_bytes_fp32_equivalent": raw_total,
        "uplink_compression_ratio": 1.0,
        "raw_training_bytes_kept_local": 0,
        "completed_rounds": cfg.rounds,
        "attempted_rounds": cfg.rounds,
        "training_time_seconds": training_time,
        "horizon_steps": cfg.horizon,
        "horizon_minutes": cfg.horizon * ds.spec.interval_minutes,
        "unit": summary["dataset"]["unit"],
    }
    ctl.log("SERVER", f"Test (epoch {best['round']} checkpoint): MAE {ts['mae']:.3f}, RMSE {ts['rmse']:.3f}, MAPE {ts['mape']:.2f}%", "success")
    return {"metrics": metrics, "predictions": predictions}


def run(cfg: ExperimentConfig, ctl: Control) -> dict:
    return run_federated(cfg, ctl) if cfg.mode == "federated" else run_centralized(cfg, ctl)
