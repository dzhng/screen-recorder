"""Restore every retained capture pathname and verify original bytes."""
import hashlib
import json
import os
from pathlib import Path
import sys
import tarfile

here = Path(__file__).resolve().parent
out = Path(sys.argv[1]).resolve()
out.mkdir()
archive = here / 'captures.tar.xz'
summary = json.loads((here / 'archive.json').read_text())
assert hashlib.sha256(archive.read_bytes()).hexdigest() == summary['sha256']
with tarfile.open(archive) as source:
    source.extractall(out, filter='data')
for entry in json.loads((here / 'files.json').read_text()):
    source = out / entry['storedAs']
    target = out / entry['path']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == entry['sha256']
    if source != target:
        target.parent.mkdir(parents=True, exist_ok=True)
        os.link(source, target)
print(out / 'review' / 'brief.txt')
