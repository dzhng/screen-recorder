"""Verify and restore every captured path, including duplicate-file aliases."""
import hashlib
import json
import os
from pathlib import Path
import sys
import tarfile

here = Path(__file__).resolve().parent
output = Path(sys.argv[1]).resolve()
output.mkdir()
receipt = json.loads((here / "archive.json").read_text())
archive = here / receipt["archive"]
assert hashlib.sha256(archive.read_bytes()).hexdigest() == receipt["sha256"]
with tarfile.open(archive) as source:
    source.extractall(output, filter="data")
files = json.loads((here / "files.json").read_text())
for entry in files:
    source = output / entry["storedAs"]
    target = output / entry["path"]
    assert hashlib.sha256(source.read_bytes()).hexdigest() == entry["sha256"]
    if source != target:
        target.parent.mkdir(parents=True, exist_ok=True)
        os.link(source, target)
print(output / "capture/review/brief.txt")
