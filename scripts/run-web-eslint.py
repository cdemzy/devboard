from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


repository_root = Path(__file__).resolve().parents[1]
web_root = repository_root / "apps" / "web"
web_files = [
    str(Path(file).resolve().relative_to(web_root))
    for file in sys.argv[1:]
]
npm_command = "npm.cmd" if os.name == "nt" else "npm"
result = subprocess.run([npm_command, "exec", "eslint", "--", *web_files], cwd=web_root)
raise SystemExit(result.returncode)
