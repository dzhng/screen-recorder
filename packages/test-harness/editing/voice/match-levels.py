"""Create gain-only auditions from frozen voice evidence; no synthesis or playback."""
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from scipy.io import wavfile

source, output = map(Path, sys.argv[1:])
output.mkdir(parents=True, exist_ok=True)
manifest = json.loads((source / "manifest.json").read_text())
rate, context = wavfile.read(source / "context.wav")


def rms(samples):
    return float(np.sqrt(np.mean(samples.astype(np.float64) ** 2)))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


report = {"method": "Match full-segment RMS to up to two seconds of original audio on each side, excluding the replaced interval. Constant gain on generated samples only; no fades or retiming. This is an audition, not a perceptual loudness or speech-quality gate.", "cases": []}
for kind in ["word", "phrase"]:
    run = next(r for r in manifest["runs"] if r["id"] == "same-take-" + kind)
    raw_path = source / (run["id"] + ".wav")
    raw_rate, raw = wavfile.read(raw_path)
    assert raw_rate == rate and sha(raw_path) == run["rawSha256"]
    first, last = run["joinsFrames"]
    source_end = first + round(run["targetDurationSeconds"] * rate)
    nearby = np.concatenate([context[max(0, first - 2 * rate):first], context[source_end:source_end + 2 * rate]])
    assert rms(raw) > 0 and rms(nearby) > 0
    gain = rms(nearby) / rms(raw)
    adjusted = (raw.astype(np.float64) * gain).astype(np.float32)
    splice = np.concatenate([context[:first], adjusted, context[source_end:]])
    path = output / (kind + "-matched-context.wav")
    wavfile.write(path, rate, splice)
    saved_rate, saved = wavfile.read(path)
    assert saved_rate == rate and np.isfinite(saved).all()
    assert np.array_equal(saved[:first], context[:first])
    assert np.array_equal(saved[last:], context[source_end:])
    assert np.array_equal(saved[first:last], adjusted)
    assert len(saved) == len(context) - (source_end - first) + len(raw)
    assert abs(20 * np.log10(rms(saved[first:last]) / rms(nearby))) < 0.00001
    report["cases"].append({"id": kind, "gainDb": float(20 * np.log10(gain)), "surroundingRmsDbfs": float(20 * np.log10(rms(nearby))), "generatedRmsDbfs": float(20 * np.log10(rms(raw))), "sourceSha256": sha(raw_path), "outputSha256": sha(path), "checks": "Exact original prefix/suffix, exact gain-adjusted insert, unchanged sample count, finite PCM and matched RMS."})
(output / "report.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
