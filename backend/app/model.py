"""Compact GRU forecaster shared by every client (identical parameter structure for FedAvg)."""

from __future__ import annotations

import numpy as np
import torch
from torch import nn


class GRUForecaster(nn.Module):
    def __init__(self, input_size: int, hidden_size: int, horizon: int):
        super().__init__()
        self.gru = nn.GRU(input_size, hidden_size, batch_first=True)
        self.head = nn.Sequential(nn.Linear(hidden_size, hidden_size), nn.ReLU(), nn.Linear(hidden_size, horizon))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out, _ = self.gru(x)
        return self.head(out[:, -1, :])


def get_weights(model: nn.Module) -> dict[str, np.ndarray]:
    return {k: v.detach().cpu().numpy().astype(np.float32).copy() for k, v in model.state_dict().items()}


def set_weights(model: nn.Module, weights: dict[str, np.ndarray]) -> None:
    model.load_state_dict({k: torch.from_numpy(np.asarray(v, dtype=np.float32)) for k, v in weights.items()})


def count_parameters(model: nn.Module) -> int:
    return int(sum(p.numel() for p in model.parameters()))
