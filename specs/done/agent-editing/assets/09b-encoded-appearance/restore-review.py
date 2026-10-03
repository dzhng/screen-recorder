"""Extract checked capture archives and restore neutral review aliases."""
import hashlib
import json
import os
import sys
import tarfile
from pathlib import Path

here = Path(__file__).resolve().parent
output = Path(sys.argv[1]).resolve()
output.mkdir()  # Refuse to merge into an existing evidence tree.
for entry in json.loads((here / "archives.json").read_text()):
    archive = here / entry["archive"]
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == entry["sha256"]
    with tarfile.open(archive) as source:
        source.extractall(output, filter="data")

# Retain every captured pathname while storing identical bytes only once.
for entry in json.loads((here / "files.json").read_text()):
    source = output / entry["storedAs"]
    target = output / entry["path"]
    assert hashlib.sha256(source.read_bytes()).hexdigest() == entry["sha256"]
    if source != target:
        target.parent.mkdir(parents=True, exist_ok=True)
        os.link(source, target)

for label, cohort, mode in [
    ("A", "frozen", "full"), ("B", "frozen", "range"),
    ("C", "shifted-control", "full"), ("D", "missing-control", "full"),
    ("E", "recorded", "full"), ("F", "recorded", "range"),
]:
    movie = output / cohort / mode
    neutral = output / "review" / f"{label}-frames"
    neutral.mkdir()
    for source in (movie / "decoded").iterdir():
        if source.suffix in (".png", ".icc", ".json"):
            os.link(source, neutral / source.name)
    os.link(movie / "movie.mp4", output / "review" / f"{label}.mp4")
assert sum(len(list((output / "review" / f"{label}-frames").glob("*.png"))) for label in "ABCDEF") == 595
print(output / "review" / "brief.txt")
