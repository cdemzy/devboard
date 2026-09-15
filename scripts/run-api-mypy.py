from __future__ import annotations

import subprocess
from pathlib import Path


repository_root = Path(__file__).resolve().parents[1]
api_root = repository_root / "apps" / "api"
result = subprocess.run(["uv", "run", "mypy"], cwd=api_root)
raise SystemExit(result.returncode)
