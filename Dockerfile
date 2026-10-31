# FedTraffic: one container serving the API and the built dashboard.
# Works on Hugging Face Spaces (Docker), Render, Railway, Fly.io, or any Docker host.

# ---------- 1. Build the frontend ----------
FROM node:22-slim AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---------- 2. Python backend ----------
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    FEDTRAFFIC_FRONTEND_DIST=/app/frontend/dist \
    FEDTRAFFIC_DATA_DIR=/app/backend/data \
    FEDTRAFFIC_DB_PATH=/app/state/fedtraffic.db \
    FEDTRAFFIC_TORCH_THREADS=2 \
    PORT=7860

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend
RUN pip install --index-url https://download.pytorch.org/whl/cpu torch \
    && pip install "fastapi>=0.110" "uvicorn[standard]>=0.29" "pydantic>=2.6" "numpy>=1.26" "pandas>=2.1"

# Dataset baked into the image (PeMS04, ~32 MB). The build fails if it cannot be
# downloaded, so a deployment never silently runs without the real data.
COPY backend/download_data.sh ./
RUN bash download_data.sh

COPY backend/app ./app
COPY --from=frontend /build/dist /app/frontend/dist

# Writable state dir (SQLite). Platforms such as HF Spaces run as a non-root user.
RUN mkdir -p /app/state && chmod -R 777 /app/state

EXPOSE 7860
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
