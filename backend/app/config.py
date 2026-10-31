import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BACKEND_DIR.parent


def _load_env_file(path: Path) -> None:
    """Load KEY=VALUE lines from backend/.env. Real environment variables always win."""
    if not path.is_file():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        os.environ.setdefault(key, value)


_load_env_file(Path(os.environ.get("FEDTRAFFIC_ENV_FILE", BACKEND_DIR / ".env")))

DATA_DIR = Path(os.environ.get("FEDTRAFFIC_DATA_DIR", BACKEND_DIR / "data"))
DB_PATH = Path(os.environ.get("FEDTRAFFIC_DB_PATH", BACKEND_DIR / "fedtraffic.db"))
FRONTEND_DIST = Path(os.environ.get("FEDTRAFFIC_FRONTEND_DIST", PROJECT_DIR / "frontend" / "dist"))

# CPU threads used by PyTorch for one training job.
TORCH_THREADS = int(os.environ.get("FEDTRAFFIC_TORCH_THREADS", "4"))

# Comma-separated list of allowed CORS origins ("*" for any).
CORS_ORIGINS = [o.strip() for o in os.environ.get("FEDTRAFFIC_CORS_ORIGINS", "*").split(",") if o.strip()]
