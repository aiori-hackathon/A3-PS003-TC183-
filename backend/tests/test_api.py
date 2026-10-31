"""End-to-end checks of the PRD acceptance criteria, using the synthetic dataset for speed."""

import os
import tempfile
import time

import numpy as np
import pytest

os.environ["FEDTRAFFIC_DB_PATH"] = os.path.join(tempfile.mkdtemp(), "test.db")

from fastapi.testclient import TestClient  # noqa: E402

from app import compression, datasets, partition  # noqa: E402
from app.main import app  # noqa: E402

FAST = {"dataset_id": "synthetic", "num_sensors": 10, "num_clients": 3, "rounds": 2, "max_local_steps": 5, "batch_size": 32, "eval_stride": 12}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def wait(client, exp_id, timeout=120):
    t0 = time.time()
    while time.time() - t0 < timeout:
        e = client.get(f"/api/experiments/{exp_id}").json()
        if e["status"] in ("completed", "failed", "cancelled"):
            return e
        time.sleep(0.2)
    raise TimeoutError(exp_id)


def test_compression_roundtrip():
    rng = np.random.default_rng(0)
    w = {"a": rng.normal(size=(40, 3)).astype(np.float32), "b": rng.normal(size=7).astype(np.float32)}
    assert all(np.array_equal(compression.decode(compression.encode(w, "fp32"))[k], w[k]) for k in w)
    sizes = {m: len(compression.encode(w, m, 0.1)) for m in compression.UPLINK_ENCODINGS}
    assert sizes["fp16"] < sizes["fp32"] and sizes["int8"] < sizes["fp16"] and sizes["topk"] < sizes["int8"]
    d = compression.decode(compression.encode(w, "topk", 0.1))
    assert sum(int((d[k] != 0).sum()) for k in d) == int(np.ceil(0.1 * 127))


def test_splits_are_chronological_and_disjoint():
    s = datasets.chronological_splits(1000, 0.7, 0.15)
    assert s.train[1] == s.val[0] and s.val[1] == s.test[0] and s.test[1] == 1000


def test_partition_disjoint_and_complete():
    cols = list(range(30))
    level = np.linspace(1, 100, 30)
    for strat in ("contiguous", "iid", "dirichlet"):
        groups = partition.partition(cols, level, 5, strat, 0.1, 42)
        flat = [c for g in groups for c in g]
        assert sorted(flat) == cols and all(groups)


def test_health_and_datasets(client):
    assert client.get("/api/health").json()["status"] == "ok"
    ids = {d["id"]: d for d in client.get("/api/datasets").json()}
    assert ids["synthetic"]["available"] and ids["synthetic"]["is_synthetic"]


def test_validation_errors(client):
    r = client.post("/api/experiments", json={**FAST, "target": "volume"})
    assert r.status_code == 422 and "not in dataset" in r.text
    r = client.post("/api/experiments", json={**FAST, "num_clients": 11})
    assert r.status_code == 422


def test_federated_run_ledger_and_metrics(client):
    r = client.post("/api/experiments", json=FAST, headers={"Idempotency-Key": "t1"})
    assert r.status_code == 201
    exp_id = r.json()["id"]
    assert client.post("/api/experiments", json=FAST, headers={"Idempotency-Key": "t1"}).json()["id"] == exp_id  # no duplicate run
    e = wait(client, exp_id)
    assert e["status"] == "completed", e["error"]
    m = e["metrics"]
    assert m["completed_rounds"] == 2 and m["mae"] > 0 and m["rmse"] >= m["mae"]

    comm = client.get(f"/api/experiments/{exp_id}/communication").json()
    assert comm["ledger_matches_reported_totals"] is True
    assert comm["totals"]["total_bytes"] == comm["totals"]["upload_bytes"] + comm["totals"]["download_bytes"]
    assert len(comm["ledger"]) == 2 * 3
    assert all(row["transfer_type"] == "serialized_payload" for row in comm["ledger"])

    summary = e["summary"]
    assert summary["federation"]["uplink_payload"].startswith("model update")
    sensors = [s for c in summary["federation"]["clients"] for s in c["sensors"]]
    assert len(sensors) == len(set(sensors)) == 10

    preds = client.get(f"/api/experiments/{exp_id}/predictions").json()
    assert preds["available"] and len(preds["traces"]) == 3
    t = preds["traces"][0]
    assert len(t["timestamps"]) == len(t["actual"]) == len(t["predicted_by_step"]["1"])
    assert t["timestamps"][0] >= summary["dataset"]["splits"]["test"]["start"]

    assert client.get(f"/api/experiments/{exp_id}/export?format=csv&table=ledger").text.startswith("round,")
    assert client.get(f"/api/experiments/{exp_id}/export?format=json").json()["experiment"]["id"] == exp_id


def test_global_model_changes_and_compression_reduces_bytes(client):
    a = wait(client, client.post("/api/experiments", json=FAST).json()["id"])
    b = wait(client, client.post("/api/experiments", json={**FAST, "uplink_encoding": "int8"}).json()["id"])
    rounds = client.get(f"/api/experiments/{a['id']}/rounds").json()
    assert rounds[0]["val_mae"] != rounds[1]["val_mae"]
    assert b["metrics"]["total_upload_bytes"] < a["metrics"]["total_upload_bytes"]
    assert b["metrics"]["total_download_bytes"] == a["metrics"]["total_download_bytes"]
    cmp = client.get(f"/api/compare?ids={a['id']},{b['id']}&baseline={a['id']}").json()
    assert cmp["comparable"] and cmp["rows"][1]["communication_reduction_pct_vs_baseline"] > 0


def test_failed_rounds_not_counted(client):
    e = wait(client, client.post("/api/experiments", json={**FAST, "client_dropout_prob": 0.99, "rounds": 3}).json()["id"])
    assert e["status"] == "completed"
    rounds = client.get(f"/api/experiments/{e['id']}/rounds").json()
    failed = [r for r in rounds if r["status"] == "failed"]
    assert e["completed_rounds"] == 3 - len(failed)
    assert all(r["upload_bytes"] == 0 for r in failed)


def test_pause_step_cancel(client):
    exp_id = client.post("/api/experiments", json={**FAST, "rounds": 50, "start_paused": True}).json()["id"]
    time.sleep(1.0)
    assert client.get(f"/api/experiments/{exp_id}").json()["current_round"] == 0
    client.post(f"/api/experiments/{exp_id}/step", json={"count": 1})
    t0 = time.time()
    while client.get(f"/api/experiments/{exp_id}").json()["current_round"] < 1 and time.time() - t0 < 30:
        time.sleep(0.2)
    time.sleep(1.0)
    assert client.get(f"/api/experiments/{exp_id}").json()["current_round"] == 1
    client.post(f"/api/experiments/{exp_id}/cancel")
    e = wait(client, exp_id)
    assert e["status"] == "cancelled" and e["metrics"] is None


def test_centralized_and_suite(client):
    r = client.post("/api/suites", json={"base": FAST, "include": ["CENTRAL", "A"]}).json()
    exps = [wait(client, e["id"]) for e in r["experiments"]]
    cen = next(e for e in exps if e["mode"] == "centralized")
    assert cen["status"] == "completed"
    assert cen["metrics"]["total_communication_bytes"] == cen["summary"]["centralized"]["raw_upload_bytes"]
