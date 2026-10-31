"""SQLite persistence for experiments, rounds, the communication ledger and event logs."""

from __future__ import annotations

import json
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path

from .config import DB_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS experiments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mode TEXT NOT NULL,
    status TEXT NOT NULL,
    config TEXT NOT NULL,
    idempotency_key TEXT,
    suite_id TEXT,
    suite_label TEXT,
    created_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    error TEXT,
    current_round INTEGER NOT NULL DEFAULT 0,
    completed_rounds INTEGER NOT NULL DEFAULT 0,
    total_rounds INTEGER NOT NULL,
    paused INTEGER NOT NULL DEFAULT 0,
    summary TEXT,
    metrics TEXT,
    predictions TEXT,
    end_to_end_runtime_seconds REAL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_exp_idem ON experiments(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE TABLE IF NOT EXISTS rounds (
    experiment_id TEXT NOT NULL,
    round INTEGER NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (experiment_id, round)
);
CREATE TABLE IF NOT EXISTS ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_id TEXT NOT NULL,
    round INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    upload_bytes INTEGER NOT NULL,
    download_bytes INTEGER NOT NULL,
    raw_upload_bytes INTEGER NOT NULL,
    transfer_type TEXT NOT NULL,
    status TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_exp ON ledger(experiment_id, round);
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_id TEXT NOT NULL,
    ts TEXT NOT NULL,
    level TEXT NOT NULL,
    prefix TEXT NOT NULL,
    text TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_exp ON events(experiment_id, id);
"""

JSON_COLS = ("config", "summary", "metrics", "predictions")


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


class Database:
    def __init__(self, path: Path = DB_PATH):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(self.path, check_same_thread=False, isolation_level=None)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._lock = threading.RLock()
        with self._lock:
            self._conn.executescript(SCHEMA)

    def execute(self, sql: str, params=()):
        with self._lock:
            return self._conn.execute(sql, params)

    def query(self, sql: str, params=()) -> list[sqlite3.Row]:
        with self._lock:
            return self._conn.execute(sql, params).fetchall()

    # ----------------------------------------------------------------- experiments

    def insert_experiment(self, row: dict) -> None:
        row = {k: (json.dumps(v) if k in JSON_COLS and v is not None else v) for k, v in row.items()}
        cols = ",".join(row)
        qs = ",".join("?" for _ in row)
        self.execute(f"INSERT INTO experiments ({cols}) VALUES ({qs})", tuple(row.values()))

    def update_experiment(self, exp_id: str, **fields) -> None:
        if not fields:
            return
        fields = {k: (json.dumps(v) if k in JSON_COLS and v is not None else v) for k, v in fields.items()}
        sets = ",".join(f"{k}=?" for k in fields)
        self.execute(f"UPDATE experiments SET {sets} WHERE id=?", (*fields.values(), exp_id))

    def _decode(self, row: sqlite3.Row, include_predictions: bool = False) -> dict:
        d = dict(row)
        for k in JSON_COLS:
            if k == "predictions" and not include_predictions:
                d.pop(k, None)
                continue
            if d.get(k) is not None:
                d[k] = json.loads(d[k])
        d["paused"] = bool(d.get("paused"))
        return d

    def get_experiment(self, exp_id: str, include_predictions: bool = False) -> dict | None:
        rows = self.query("SELECT * FROM experiments WHERE id=?", (exp_id,))
        return self._decode(rows[0], include_predictions) if rows else None

    def find_by_idempotency_key(self, key: str) -> dict | None:
        rows = self.query("SELECT * FROM experiments WHERE idempotency_key=?", (key,))
        return self._decode(rows[0]) if rows else None

    def list_experiments(self, status: str | None = None, limit: int = 200) -> list[dict]:
        cols = "id,name,mode,status,config,suite_id,suite_label,created_at,started_at,completed_at,error,current_round,completed_rounds,total_rounds,paused,metrics,end_to_end_runtime_seconds,idempotency_key"
        if status:
            rows = self.query(f"SELECT {cols} FROM experiments WHERE status=? ORDER BY created_at DESC LIMIT ?", (status, limit))
        else:
            rows = self.query(f"SELECT {cols} FROM experiments ORDER BY created_at DESC LIMIT ?", (limit,))
        return [self._decode(r) for r in rows]

    def delete_experiment(self, exp_id: str) -> None:
        for table, col in (("rounds", "experiment_id"), ("ledger", "experiment_id"), ("events", "experiment_id"), ("experiments", "id")):
            self.execute(f"DELETE FROM {table} WHERE {col}=?", (exp_id,))

    def mark_interrupted(self) -> int:
        cur = self.execute(
            "UPDATE experiments SET status='failed', error=?, completed_at=? WHERE status IN ('queued','running')",
            ("Interrupted: the backend restarted before this experiment finished. Partial rounds are kept but no final metrics exist.", now()),
        )
        return cur.rowcount

    # ----------------------------------------------------------------- rounds & ledger

    def add_round(self, exp_id: str, record: dict, ledger: list[dict]) -> None:
        ts = now()
        with self._lock:
            self._conn.execute("BEGIN")
            try:
                self._conn.execute("INSERT OR REPLACE INTO rounds VALUES (?,?,?,?)", (exp_id, record["round"], json.dumps(record), ts))
                for row in ledger:
                    self._conn.execute(
                        "INSERT INTO ledger (experiment_id, round, client_id, upload_bytes, download_bytes, raw_upload_bytes, transfer_type, status, data, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
                        (exp_id, row["round"], row["client_id"], row["upload_bytes"], row["download_bytes"], row["raw_upload_bytes"], row["transfer_type"], row["status"], json.dumps(row), ts),
                    )
                self._conn.execute(
                    "UPDATE experiments SET current_round=?, completed_rounds=? WHERE id=?",
                    (record["round"], record["completed_rounds"], exp_id),
                )
                self._conn.execute("COMMIT")
            except Exception:
                self._conn.execute("ROLLBACK")
                raise

    def get_rounds(self, exp_id: str, since: int = 0) -> list[dict]:
        rows = self.query("SELECT data FROM rounds WHERE experiment_id=? AND round>? ORDER BY round", (exp_id, since))
        return [json.loads(r["data"]) for r in rows]

    def get_ledger(self, exp_id: str) -> list[dict]:
        rows = self.query("SELECT data, created_at FROM ledger WHERE experiment_id=? ORDER BY round, client_id", (exp_id,))
        out = []
        for r in rows:
            d = json.loads(r["data"])
            d["total_bytes"] = d["upload_bytes"] + d["download_bytes"]
            d["timestamp"] = r["created_at"]
            out.append(d)
        return out

    # ----------------------------------------------------------------- events

    def add_event(self, exp_id: str, prefix: str, text: str, level: str) -> None:
        self.execute("INSERT INTO events (experiment_id, ts, level, prefix, text) VALUES (?,?,?,?,?)", (exp_id, now(), level, prefix, text))

    def get_events(self, exp_id: str, after_id: int = 0, limit: int = 500) -> list[dict]:
        rows = self.query("SELECT * FROM events WHERE experiment_id=? AND id>? ORDER BY id LIMIT ?", (exp_id, after_id, limit))
        return [dict(r) for r in rows]
