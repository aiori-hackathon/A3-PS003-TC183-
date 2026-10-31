"""Background experiment execution with pause / step / resume / cancel controls.

Each experiment runs in its own thread so a paused experiment never blocks others. A semaphore
limits how many experiments use the CPU at the same moment; waiting experiments show as "queued".
"""

from __future__ import annotations

import contextlib
import os
import threading
import time
import traceback
import uuid

import torch

from . import engine
from .config import TORCH_THREADS
from .db import Database, now
from .schemas import ExperimentConfig

MAX_CONCURRENT = 1
# Upper bound on unfinished experiments, so a public demo cannot be flooded with jobs.
MAX_PENDING = int(os.environ.get("FEDTRAFFIC_MAX_PENDING", "30"))


class TooManyJobs(Exception):
    pass


class JobControl:
    def __init__(self, manager: "JobManager", exp_id: str, paused: bool):
        self.manager = manager
        self.db = manager.db
        self.exp_id = exp_id
        self.cond = threading.Condition()
        self.paused = paused
        self.step_budget = 0
        self.cancelled = False
        self.started = False
        self.t_started: float | None = None
        self.holding = False  # owns the CPU slot; kept between rounds so queued jobs run one after another

    # -- Control protocol -----------------------------------------------------
    def gate(self, round_number: int) -> None:
        with self.cond:
            announced = False
            while True:
                if self.cancelled:
                    raise engine.Cancelled()
                if not self.paused:
                    return
                if self.step_budget > 0:
                    self.step_budget -= 1
                    if self.step_budget == 0:
                        self.db.update_experiment(self.exp_id, paused=1)
                    return
                if not announced:
                    self.release_slot()  # let other experiments use the CPU while this one is paused
                    self.db.update_experiment(self.exp_id, paused=1)
                    self.log("CONTROL", f"Paused before round {round_number}. Waiting for step/resume.", "neutral")
                    announced = True
                self.cond.wait(timeout=1.0)

    @contextlib.contextmanager
    def compute_slot(self):
        if not self.holding:
            sem = self.manager.semaphore
            while not sem.acquire(timeout=0.5):
                if self.cancelled:
                    raise engine.Cancelled()
            self.holding = True
        if not self.started:
            self.started = True
            self.t_started = time.perf_counter()
            self.db.update_experiment(self.exp_id, status="running", started_at=now())
        yield

    def release_slot(self):
        if self.holding:
            self.holding = False
            self.manager.semaphore.release()

    def log(self, prefix: str, text: str, level: str = "info") -> None:
        self.db.add_event(self.exp_id, f"[{prefix}]", text, level)

    def on_setup(self, summary: dict) -> None:
        self.db.update_experiment(self.exp_id, summary=summary)

    def on_round(self, record: dict, ledger: list[dict]) -> None:
        self.db.add_round(self.exp_id, record, ledger)

    # -- external commands ----------------------------------------------------
    def pause(self):
        with self.cond:
            self.paused = True
            self.step_budget = 0
            self.db.update_experiment(self.exp_id, paused=1)
            self.cond.notify_all()

    def resume(self):
        with self.cond:
            self.paused = False
            self.step_budget = 0
            self.db.update_experiment(self.exp_id, paused=0)
            self.cond.notify_all()

    def step(self, count: int):
        with self.cond:
            self.paused = True
            self.step_budget += count
            self.db.update_experiment(self.exp_id, paused=0)
            self.cond.notify_all()

    def cancel(self):
        with self.cond:
            self.cancelled = True
            self.cond.notify_all()


class JobManager:
    def __init__(self, db: Database):
        self.db = db
        self.semaphore = threading.Semaphore(MAX_CONCURRENT)
        self.controls: dict[str, JobControl] = {}
        self._lock = threading.Lock()
        torch.set_num_threads(TORCH_THREADS)

    def submit(self, cfg: ExperimentConfig, idempotency_key: str | None = None, suite_id: str | None = None, suite_label: str | None = None) -> tuple[dict, bool]:
        """Create and start an experiment. Returns (experiment, created)."""
        with self._lock:
            if idempotency_key:
                existing = self.db.find_by_idempotency_key(idempotency_key)
                if existing:
                    return existing, False
            if len(self.controls) >= MAX_PENDING:
                raise TooManyJobs(f"{len(self.controls)} experiments are already queued or running; wait for some to finish or cancel them.")
            exp_id = uuid.uuid4().hex[:12]
            name = cfg.name or default_name(cfg)
            self.db.insert_experiment(
                {
                    "id": exp_id,
                    "name": name,
                    "mode": cfg.mode,
                    "status": "queued",
                    "config": cfg.model_dump(),
                    "idempotency_key": idempotency_key,
                    "suite_id": suite_id,
                    "suite_label": suite_label,
                    "created_at": now(),
                    "total_rounds": cfg.rounds,
                    "paused": 1 if cfg.start_paused else 0,
                }
            )
            ctl = JobControl(self, exp_id, paused=cfg.start_paused)
            self.controls[exp_id] = ctl
        self.db.add_event(exp_id, "[CONTROL]", f"Experiment '{name}' queued.", "neutral")
        threading.Thread(target=self._run, args=(exp_id, cfg, ctl), daemon=True, name=f"exp-{exp_id}").start()
        return self.db.get_experiment(exp_id), True

    def _run(self, exp_id: str, cfg: ExperimentConfig, ctl: JobControl) -> None:
        def runtime() -> float | None:
            # From the moment the job first got CPU (data loading), excluding time queued behind other jobs.
            return time.perf_counter() - ctl.t_started if ctl.t_started else None

        try:
            result = engine.run(cfg, ctl)
            metrics = result["metrics"]
            metrics["end_to_end_runtime_seconds"] = runtime()
            self.db.update_experiment(
                exp_id, status="completed", completed_at=now(), metrics=metrics, predictions=result["predictions"], end_to_end_runtime_seconds=metrics["end_to_end_runtime_seconds"], paused=0
            )
            ctl.log("CONTROL", f"Experiment completed in {metrics['end_to_end_runtime_seconds']:.1f} s.", "success")
        except engine.Cancelled:
            self.db.update_experiment(exp_id, status="cancelled", completed_at=now(), end_to_end_runtime_seconds=runtime(), paused=0,
                                      error="Cancelled by user. Rounds finished before cancellation are kept; no final test metrics were computed.")
            ctl.log("CONTROL", "Experiment cancelled.", "warning")
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            self.db.update_experiment(exp_id, status="failed", completed_at=now(), error=f"{type(e).__name__}: {e}", end_to_end_runtime_seconds=runtime(), paused=0)
            ctl.log("ERROR", f"Experiment failed: {type(e).__name__}: {e}", "error")
        finally:
            ctl.release_slot()
            with self._lock:
                self.controls.pop(exp_id, None)

    def control(self, exp_id: str) -> JobControl | None:
        return self.controls.get(exp_id)


def default_name(cfg: ExperimentConfig) -> str:
    if cfg.mode == "centralized":
        return f"Centralized | {cfg.dataset_id} {cfg.target} | {cfg.rounds} epochs | seed {cfg.seed}"
    parts = [cfg.aggregation.upper(), f"{cfg.num_clients} clients", cfg.partition + (f" a={cfg.alpha}" if cfg.partition == "dirichlet" else ""), f"{cfg.rounds} rds", cfg.uplink_encoding]
    if cfg.uplink_encoding == "topk":
        parts[-1] += f" {cfg.topk_ratio:g}"
    if cfg.client_fraction < 1:
        parts.append(f"C={cfg.client_fraction:g}")
    return " | ".join(parts) + f" | seed {cfg.seed}"
