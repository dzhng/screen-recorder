"""Case-selected acoustic research. No inference, edits or clock declarations."""
import argparse
import hashlib
import importlib.util
import itertools
import json
import platform
import subprocess
import time
from pathlib import Path

import numpy as np
import scipy
from scipy.io import wavfile

spec = importlib.util.spec_from_file_location("offset", Path(__file__).with_name("offset.py"))
offset = importlib.util.module_from_spec(spec)
spec.loader.exec_module(offset)


def digest(path):
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def save(path, value):
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n")


def invoke(native, directory, name, operation, params):
    request = {"id": name, "operation": operation, "params": params}
    save(directory / (name + ".request.json"), request)
    started = time.monotonic()
    result = subprocess.run(
        [str(native)], input=json.dumps(request) + "\n", capture_output=True,
        text=True, timeout=30,
    )
    (directory / (name + ".stdout.json")).write_text(result.stdout)
    (directory / (name + ".stderr.log")).write_text(result.stderr)
    if result.returncode:
        raise RuntimeError(result.stderr + result.stdout)
    response = json.loads(result.stdout)
    if not response.get("ok"):
        raise RuntimeError(str(response))
    return response["data"], time.monotonic() - started


def decode(native, directory, name, source, selected, output):
    probe, _ = invoke(native, directory, name + "-probe", "media.probe", {"path": str(source)})
    streams = [s for s in probe["streams"] if s["kind"] == "audio"]
    if len(streams) != 1:
        raise ValueError("Select fixture sources with one explicit audio stream")
    stream = streams[0]
    data, elapsed = invoke(native, directory, name, "media.sourceChannelPCM", {
        "source": {"source": str(source), "streamId": stream["id"], "sourceOffsetUs": 0,
                   "available": [{"startUs": stream["startUs"], "endUs": stream["endUs"]}]},
        "range": selected, "channel": 0, "output": str(output),
    })
    if (data["frames"], data["bytes"], data["sampleRate"], data["channels"]) != (320000, 1280000, 16000, 1):
        raise ValueError("Selected decoder did not deliver complete20s mono16k")
    if digest(output) != data["sha256"]:
        raise ValueError("Native PCM receipt does not match retained bytes")
    return probe, data, elapsed


def acquire(args):
    protocol = json.loads(args.protocol.read_text())
    sources = protocol["sources"]
    ranges = protocol["realScouts"]["rangesSeconds"]
    if (len(sources) != 3 or set(sources) != set(protocol["realScouts"]["sources"]) or
            len(ranges) != 3 or len({tuple(r) for r in ranges}) != 3 or
            any(len(r) != 2 or any(type(v) is not int for v in r) or r[0] < 0 or r[1] - r[0] != 20 for r in ranges) or
            not 0 < protocol["budget"]["maximumSourceDecodes"] <= 9 or
            len(sources) * len(ranges) > protocol["budget"]["maximumSourceDecodes"]):
        raise ValueError("Acquisition exceeds frozen bounds: three sources, three distinct20s windows, at most nine decodes")
    report = {"nativeSha256": digest(args.native), "sources": {}, "outputs": []}
    for key, original in protocol["sources"].items():
        source = args.originals / original["file"]
        if digest(source) != original["sha256"]:
            raise ValueError("External original hash changed: " + key)
        for start, end in protocol["realScouts"]["rangesSeconds"]:
            name = key + "-" + str(start)
            selected = {"startUs": start * 1000000, "endUs": end * 1000000}
            probe, receipt, elapsed = decode(args.native, args.output, name, source, selected, args.output / (name + ".f32"))
            report["sources"][key] = {"path": str(source), "sha256": original["sha256"], "probe": probe}
            report["outputs"].append({"name": name, "source": key, "selected": selected,
                                      "elapsedSeconds": elapsed, "receipt": receipt})
            save(args.output / "report.json", report)
            print(name, "decoded", flush=True)


def retain(args):
    report = json.loads((args.acquisition / "report.json").read_text())
    if len(report["outputs"]) != 9:
        raise ValueError("Retain the complete frozen nine-window acquisition")
    manifest = {"sourceReportSha256": digest(args.acquisition / "report.json"),
                "nativeSha256": report["nativeSha256"], "sources": report["sources"], "cases": []}
    for entry in report["outputs"]:
        name, receipt = entry["name"], entry["receipt"]
        raw = args.acquisition / (name + ".f32")
        if digest(raw) != receipt["sha256"] or raw.stat().st_size != 1280000:
            raise ValueError("Captured PCM changed: " + name)
        samples = np.fromfile(raw, dtype="<f4")
        if len(samples) != 320000 or not np.isfinite(samples).all():
            raise ValueError("Captured PCM is not complete finite20s mono16k")
        path = args.output / (name + ".wav")
        wavfile.write(path, 16000, samples)
        rate, returned = wavfile.read(path)
        if rate != 16000 or returned.tobytes() != raw.read_bytes():
            raise ValueError("WAV wrapping changed Float32 operands")
        manifest["cases"].append({"name": name, "source": entry["source"],
                                  "range": entry["selected"], "path": path.name,
                                  "bytes": path.stat().st_size, "sha256": digest(path),
                                  "pcmSha256": receipt["sha256"], "frames": 320000, "sampleRate": 16000})
    save(args.output / "manifest.json", manifest)


def replay(args):
    manifest = json.loads((args.fixtures / "manifest.json").read_text())
    cases = manifest["cases"]
    expected = set(itertools.product(manifest["sources"], (0, 240000000, 1200000000)))
    if (len(manifest["sources"]) != 3 or len(cases) != 9 or
            {(c["source"], c["range"]["startUs"]) for c in cases} != expected or
            len({c["name"] for c in cases}) != 9 or
            any(c["frames"] != 320000 or c["sampleRate"] != 16000 or
                type(c["range"]["startUs"]) is not int or type(c["range"]["endUs"]) is not int or
                c["range"]["endUs"] - c["range"]["startUs"] != 20000000 for c in cases)):
        raise ValueError("Replay exceeds frozen bounds: nine distinct complete20s mono16k source/windows")
    operands, native_checks = {}, []
    for case in manifest["cases"]:
        path = args.fixtures / case["path"]
        if digest(path) != case["sha256"] or path.stat().st_size != case["bytes"]:
            raise ValueError("Retained fixture hash changed: " + case["name"])
        rate, samples = wavfile.read(path)
        if (rate != 16000 or samples.dtype != np.dtype("float32") or samples.shape != (320000,) or
                not np.isfinite(samples).all() or hashlib.sha256(samples.tobytes()).hexdigest() != case["pcmSha256"]):
            raise ValueError("Retained fixture PCM changed: " + case["name"])
        operands[(case["source"], case["range"]["startUs"])] = samples
        if args.native:
            _, receipt, elapsed = decode(args.native, args.output, case["name"], path,
                                         {"startUs": 0, "endUs": 20000000}, args.output / (case["name"] + ".f32"))
            if receipt["sha256"] != case["pcmSha256"]:
                raise ValueError("Native fixture re-decode changed captured operands")
            native_checks.append({"name": case["name"], "receipt": receipt, "elapsedSeconds": elapsed})
    comparisons = []
    for start in (0, 240000000, 1200000000):
        for left, right in itertools.combinations(manifest["sources"], 2):
            a, b = operands[(left, start)], operands[(right, start)]
            began = time.monotonic()
            result = offset.estimate(a, b, 16000)
            comparisons.append({"left": left, "right": right, "rangeSeconds": [start // 1000000, start // 1000000 + 20],
                                "elapsedSeconds": time.monotonic() - began,
                                "rms": [float(np.sqrt(np.mean(x.astype(np.float64) ** 2))) for x in (a, b)], "result": result})
            print(left, right, start, result["state"], flush=True)
    save(args.output / "comparisons.json", comparisons)
    reference_path = args.reference or Path(__file__).resolve().parents[4] / "specs/done/video-editing-feedback/assets/20-synchronization/original-comparisons.json"
    reference = json.loads(reference_path.read_text())
    comparable = lambda rows: [{k: v for k, v in row.items() if k != "elapsedSeconds"} for row in rows]
    if comparable(comparisons) != comparable(reference):
        raise ValueError("Frozen comparison differs; refused candidate remains in comparisons.json")
    save(args.output / "replay.json", {"python": platform.python_version(), "numpy": np.__version__, "scipy": scipy.__version__,
                                      "manifestSha256": digest(args.fixtures / "manifest.json"),
                                      "referenceSha256": digest(reference_path), "exactComparisonParity": True,
                                      "estimatorSha256": digest(Path(__file__).with_name("offset.py")),
                                      "nativeSha256": digest(args.native) if args.native else None,
                                      "nativeChecks": native_checks, "clockDeclared": False})


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    acquisition = commands.add_parser("acquire", help="Hash-check originals and acquire nine frozen20s windows; no inference")
    acquisition.add_argument("--protocol", type=Path, required=True)
    acquisition.add_argument("--originals", type=Path, required=True)
    acquisition.add_argument("--native", type=Path, required=True)
    retention = commands.add_parser("retain", help="Wrap captured Float32 operands losslessly for existing WAV LFS ownership")
    retention.add_argument("--acquisition", type=Path, required=True)
    reproduction = commands.add_parser("replay", help="Verify retained operands and repeat acoustic comparisons; optional native re-decode")
    reproduction.add_argument("--fixtures", type=Path, required=True)
    reproduction.add_argument("--native", type=Path)
    reproduction.add_argument("--reference", type=Path, help="Frozen comparison receipt (defaults to feature evidence)")
    for command in (acquisition, retention, reproduction):
        command.add_argument("--output", type=Path, required=True, help="New owned output directory")
    arguments = parser.parse_args()
    for key, value in vars(arguments).items():
        if isinstance(value, Path):
            setattr(arguments, key, value.resolve())
    arguments.output.mkdir()
    {"acquire": acquire, "retain": retain, "replay": replay}[arguments.command](arguments)
