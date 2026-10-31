import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BACKEND_DIR.parent

DATA_DIR = Path(os.environ.get("FEDTRAFFIC_DATA_DIR", BACKEND_DIR / "data"))
DB_PATH = Path(os.environ.get("FEDTRAFFIC_DB_PATH", BACKEND_DIR / "fedtraffic.db"))
FRONTEND_DIST = Path(os.environ.get("FEDTRAFFIC_FRONTEND_DIST", PROJECT_DIR / "frontend" / "dist"))

# CPU threads used by PyTorch for one training job.
TORCH_THREADS = int(os.environ.get("FEDTRAFFIC_TORCH_THREADS", "4"))

# Comma-separated list of allowed CORS origins ("*" for any).
CORS_ORIGINS = [o.strip() for o in os.environ.get("FEDTRAFFIC_CORS_ORIGINS", "*").split(",") if o.strip()]
