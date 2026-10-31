#!/usr/bin/env bash
# Download the PeMS04 benchmark (PEMS04.npz, ~32 MB) released with the ASTGCN paper.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p data

URLS=(
  "https://raw.githubusercontent.com/Davidham3/ASTGCN/master/data/PEMS04/pems04.npz"
  "https://github.com/Davidham3/ASTGCN/raw/master/data/PEMS04/pems04.npz"
)
for url in "${URLS[@]}"; do
  echo "[fedtraffic] downloading PeMS04 from $url"
  if curl -fL --retry 3 -o data/PEMS04.npz.part "$url"; then
    # Must be a zip (npz) archive of a sensible size, not an HTML error page.
    if [ "$(head -c 2 data/PEMS04.npz.part)" = "PK" ] && [ "$(wc -c < data/PEMS04.npz.part)" -gt 10000000 ]; then
      mv data/PEMS04.npz.part data/PEMS04.npz
      echo "[fedtraffic] saved data/PEMS04.npz"
      exit 0
    fi
    echo "[fedtraffic] downloaded file is not a valid npz archive"
  fi
done
rm -f data/PEMS04.npz.part
echo "[fedtraffic] could not download PeMS04" >&2
exit 1
# Optional: METR-LA (speed only). Download metr-la.h5 from the DCRNN repository
# (https://github.com/liyaguang/DCRNN) into backend/data/ and `pip install tables`.
