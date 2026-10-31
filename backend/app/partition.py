"""Assign sensors to federated clients.

Each client owns a disjoint group of sensors; raw readings of a sensor only ever live on its client.
"""

from __future__ import annotations

import numpy as np

NUM_PROFILE_BINS = 5


def select_sensors(total: int, count: int, seed: int) -> list[int]:
    if count >= total:
        return list(range(total))
    rng = np.random.default_rng(seed)
    return sorted(int(i) for i in rng.choice(total, size=count, replace=False))


def profile_bins(mean_level: np.ndarray) -> np.ndarray:
    """Group sensors into traffic-level bins (quantiles of mean training value)."""
    edges = np.quantile(mean_level, np.linspace(0, 1, NUM_PROFILE_BINS + 1)[1:-1])
    return np.searchsorted(edges, mean_level, side="right")


def partition(columns: list[int], mean_level: np.ndarray, num_clients: int, strategy: str, alpha: float, seed: int) -> list[list[int]]:
    """Return one list of column indices per client.

    - contiguous: consecutive sensor indices per client (approximates geographic grouping).
    - iid: random equal-size split.
    - dirichlet: label-skew split; each traffic-level bin is divided among clients with
      proportions drawn from Dir(alpha). Small alpha = strongly non-IID.
    """
    cols = np.asarray(columns)
    rng = np.random.default_rng(seed + 7919)
    if strategy == "contiguous":
        groups = np.array_split(cols, num_clients)
    elif strategy == "iid":
        groups = np.array_split(rng.permutation(cols), num_clients)
    elif strategy == "dirichlet":
        bins = profile_bins(mean_level)
        buckets: list[list[int]] = [[] for _ in range(num_clients)]
        for b in range(NUM_PROFILE_BINS):
            members = rng.permutation(cols[bins == b])
            if len(members) == 0:
                continue
            props = rng.dirichlet(np.full(num_clients, alpha))
            cuts = (np.cumsum(props) * len(members)).astype(int)[:-1]
            for k, part in enumerate(np.split(members, cuts)):
                buckets[k].extend(int(x) for x in part)
        # Every client needs at least one sensor: move sensors from the largest clients.
        for k in range(num_clients):
            while not buckets[k]:
                donor = max(range(num_clients), key=lambda j: len(buckets[j]))
                buckets[k].append(buckets[donor].pop())
        groups = [np.array(sorted(g)) for g in buckets]
    else:
        raise ValueError(f"Unknown partition strategy '{strategy}'")
    return [sorted(int(x) for x in g) for g in groups]


def heterogeneity(groups: list[list[int]], columns: list[int], mean_level: np.ndarray) -> dict:
    """Mean total-variation distance between each client's traffic-level histogram and the global one."""
    col_pos = {c: i for i, c in enumerate(columns)}
    bins = profile_bins(mean_level)
    global_hist = np.bincount(bins, minlength=NUM_PROFILE_BINS) / len(bins)
    per_client = []
    for g in groups:
        b = bins[[col_pos[c] for c in g]]
        hist = np.bincount(b, minlength=NUM_PROFILE_BINS) / max(1, len(b))
        per_client.append(float(0.5 * np.abs(hist - global_hist).sum()))
    return {
        "metric": "total_variation_distance_of_traffic_level_histograms",
        "mean": float(np.mean(per_client)),
        "per_client": per_client,
        "bins": NUM_PROFILE_BINS,
    }
