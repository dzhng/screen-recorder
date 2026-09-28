"""Compare retained pre-append pixels and color-managed decoded movies with direct PNGs."""
from pathlib import Path
import gzip
import json
import subprocess
import sys

source = Path(__file__).resolve().parent
out = Path(sys.argv[1]).resolve()
out.mkdir()
repo = source.parents[4]


def run(*args):
    return subprocess.check_output([str(arg) for arg in args], text=True).strip()


def differences(actual, expected):
    assert len(actual) == len(expected) == 40 * 64 * 4
    values = [abs(a - b) for i, (a, b) in enumerate(zip(actual, expected)) if i % 4 != 3]
    return {"max": max(values), "mean": sum(values) / len(values),
            "differentChannels": sum(value != 0 for value in values)}


for path, name in [(source / 'WriterPixels.swift', 'writer-pixels'),
                   (repo / 'packages/test-harness/editing/FrameImagePixels.swift', 'image-pixels'),
                   (repo / 'packages/test-harness/editing/FrameColorReference.swift', 'movie-pixels')]:
    run('swiftc', '-parse-as-library', path, '-o', out / name)
request = {"movie": str(source / 'observed-full.mp4'), "output": str(out),
           "timesUs": [2000000 + 125000 * i for i in range(8)]}
(out / 'request.json').write_text(json.dumps(request))
receipts = json.loads(run(out / 'movie-pixels', out / 'request.json'))
checks = []
for i, receipt in enumerate(receipts):
    record = json.loads((source / 'full' / f'frame-{i + 16}.json').read_text())
    raw = out / f'writer-{i}.bgra'
    raw.write_bytes(gzip.decompress((source / 'full' / f'frame-{i+16}.bgra.gz').read_bytes()))
    normalized = out / f'writer-{i}.rgba'
    profile = run(out / 'writer-pixels', raw, normalized, 40, 64)
    assert profile == record['attachments']['propagate']['CGColorSpace']['iccSHA256']
    png = out / f'png-{i}.rgba'
    run(out / 'image-pixels', source.parent / f'zoom-{i}.png', png)
    movie = out / f'movie-{i}.rgba'
    run(out / 'image-pixels', receipt['file'], movie)
    expected = png.read_bytes()
    writer_error = differences(normalized.read_bytes(), expected)
    assert writer_error['max'] <= 1
    checks.append({"index": i, "writerVsDisplayedPng": writer_error,
                   "displayedMovieVsPng": differences(movie.read_bytes(), expected)})
for ranged in (source / 'range').glob('*.bgra.gz'):
    assert gzip.decompress(ranged.read_bytes()) == gzip.decompress((source / 'full' / ranged.name).read_bytes())
report = {"samples": checks, "fullRangeWriterExact": True,
          "scope": "Pre-append parity verified; encoded artifacts are measured, not accepted"}
(out / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
