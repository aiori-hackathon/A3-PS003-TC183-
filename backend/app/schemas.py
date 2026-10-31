from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

from . import datasets


class ExperimentConfig(BaseModel):
    """Settings for one experiment. Stored verbatim with the experiment record."""

    name: str | None = Field(None, max_length=120)
    mode: Literal["federated", "centralized"] = "federated"

    # Data
    dataset_id: str = "pems04"
    target: str = "flow"
    num_sensors: int = Field(50, ge=2, le=1000, description="Sensors sampled from the dataset (fixed by seed)")
    input_len: int = Field(12, ge=3, le=48, description="History window, in dataset steps")
    horizon: int = Field(12, ge=1, le=24, description="Forecast horizon, in dataset steps")
    train_frac: float = Field(0.7, gt=0.1, lt=0.95)
    val_frac: float = Field(0.15, gt=0.0, lt=0.5)
    eval_stride: int = Field(3, ge=1, le=24, description="Stride between validation windows evaluated each round")

    # Federation
    num_clients: int = Field(5, ge=2, le=50)
    partition: Literal["contiguous", "iid", "dirichlet"] = "contiguous"
    alpha: float = Field(0.5, gt=0.0, le=1000.0, description="Dirichlet concentration (dirichlet partition only)")
    rounds: int = Field(20, ge=1, le=500, description="Communication rounds (federated) or evaluation epochs (centralized)")
    client_fraction: float = Field(1.0, gt=0.0, le=1.0, description="Fraction of clients sampled per round")
    client_dropout_prob: float = Field(0.0, ge=0.0, lt=1.0, description="Probability a sampled client's upload is lost")
    aggregation: Literal["fedavg", "fedprox"] = "fedavg"
    prox_mu: float = Field(0.01, ge=0.0, le=10.0)

    # Local training
    local_epochs: int = Field(1, ge=1, le=50)
    max_local_steps: int = Field(40, ge=1, le=5000, description="Mini-batches per local epoch")
    batch_size: int = Field(64, ge=8, le=2048)
    learning_rate: float = Field(0.003, gt=0.0, le=1.0)
    hidden_size: int = Field(64, ge=8, le=256)

    # Communication
    uplink_encoding: Literal["fp32", "fp16", "int8", "topk"] = "fp32"
    topk_ratio: float = Field(0.05, gt=0.0, le=1.0)
    error_feedback: bool = True
    downlink_encoding: Literal["fp32", "fp16", "int8"] = "fp32"
    uplink_kbps: float = Field(1000.0, gt=0.0, description="Assumed client uplink bandwidth for transfer-time estimates")
    downlink_kbps: float = Field(5000.0, gt=0.0)

    seed: int = Field(42, ge=0, le=2**31 - 1)
    start_paused: bool = Field(False, description="Wait for /step or /resume before each round")

    @model_validator(mode="after")
    def _check(self):
        if self.dataset_id not in datasets.SPECS:
            raise ValueError(f"Unknown dataset '{self.dataset_id}'. Options: {', '.join(datasets.SPECS)}")
        spec = datasets.SPECS[self.dataset_id]
        ok, reason = datasets.availability(spec)
        if not ok:
            raise ValueError(f"Dataset '{self.dataset_id}' is not available: {reason}")
        if self.target not in spec.features:
            raise ValueError(f"Target '{self.target}' is not in dataset '{self.dataset_id}' (features: {', '.join(spec.features)})")
        if self.train_frac + self.val_frac > 0.95:
            raise ValueError("train_frac + val_frac must leave at least 5% of the data for testing")
        ds = datasets.load_dataset(self.dataset_id)
        if self.num_sensors > ds.num_sensors:
            raise ValueError(f"num_sensors ({self.num_sensors}) exceeds the {ds.num_sensors} sensors in '{self.dataset_id}'")
        if self.mode == "federated" and self.num_clients > self.num_sensors:
            raise ValueError(f"num_clients ({self.num_clients}) cannot exceed num_sensors ({self.num_sensors}); each client needs at least one sensor")
        return self

    def interval_minutes(self) -> int:
        return datasets.SPECS[self.dataset_id].interval_minutes


class StepRequest(BaseModel):
    count: int = Field(1, ge=1, le=500)


class SuiteRequest(BaseModel):
    base: ExperimentConfig = Field(default_factory=ExperimentConfig)
    include: list[Literal["CENTRAL", "A", "B", "C", "C2", "D", "PROX"]] = ["CENTRAL", "A", "B", "C", "C2", "D"]
