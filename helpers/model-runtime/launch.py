"""Bundle-local import layers; process lifetime and model preparation remain external."""
import json
from pathlib import Path
import runpy
import sys

root = Path(__file__).resolve().parents[1]
config = json.loads((root / "execution/imports.json").read_text())
paths = []
for relative in config["supplemental"]:
    path = root / relative
    if not path.is_dir() or not path.resolve().is_relative_to(root):
        raise RuntimeError("Prepared import layer is missing or escapes the runtime")
    paths.append(str(path))
# Ordinary startup has already processed the primary tree's own path files.
sys.path.extend(paths)
runpy.run_path(str(root / "execution/worker.py"), run_name="__main__")
