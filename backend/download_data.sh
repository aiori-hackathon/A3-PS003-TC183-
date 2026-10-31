#!/usr/bin/env bash
# Download the PeMS04 benchmark (PEMS04.npz, ~32 MB) released with the ASTGCN paper.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p data
URL="https://github.com/guoshnBJTU/ASTGCN-r-pytorch/raw/master/data/PEMS04/PEMS04.npz"
echo "[fedtraffic] downloading PeMS04 from $URL"
curl -fL --retry 3 -o data/PEMS04.npz.part "$URL"
mv data/PEMS04.npz.part data/PEMS04.npz
echo "[fedtraffic] saved data/PEMS04.npz"
# Optional: METR-LA (speed only). Download metr-la.h5 from the DCRNN repository
# (https://github.com/liyaguang/DCRNN) into backend/data/ and `pip install tables`.
