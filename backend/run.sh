#!/usr/bin/env bash
# Start the FedTraffic API. Creates a virtualenv and downloads PeMS04 on first run.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -x .venv/bin/python ]; then
  echo "[fedtraffic] creating virtualenv in backend/.venv"
  python3 -m venv .venv
  .venv/bin/pip install --upgrade pip
  .venv/bin/pip install -r requirements.txt
fi

if [ ! -f data/PEMS04.npz ]; then
  ./download_data.sh || echo "[fedtraffic] PeMS04 download failed; only the synthetic dataset will be available"
fi

exec .venv/bin/uvicorn app.main:app --host "${HOST:-127.0.0.1}" --port "${PORT:-8000}" "$@"
