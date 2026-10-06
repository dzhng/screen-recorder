"""Independent original-input offset reference; never a production fallback."""
import argparse
import array
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("ffmpeg", type=Path)
parser.add_argument("oracle", type=Path)
parser.add_argument("output", type=Path, help="new evidence directory")
parser.add_argument("--case", choices=["balanced", "peak-limited"], default="balanced")
args = parser.parse_args()
args.output.mkdir()
samples = array.array("f")
speech_gain, kick_gain, crash_gain = ((.07, .4, .08) if args.case == "balanced" else (.016, .65, .18))
for i in range(48000 * 12):
    t = i / 48000
    phase = t % .6
    speech = speech_gain * (.35 + .65 * abs(math.sin(2 * math.pi * t * .7))) * (math.sin(2 * math.pi * 211 * t) + .25 * math.sin(2 * math.pi * 733 * t))
    kick = kick_gain * math.sin(2 * math.pi * (48 + 110 * math.exp(-phase * 32)) * phase) * math.exp(-phase * 15)
    crash = crash_gain * (math.sin(2 * math.pi * 4017 * phase) + .4 * math.sin(2 * math.pi * 7031 * phase)) * math.exp(-phase * 65) * min(1, phase / .001)
    taper = min(1, t / .1, (12 - t - 1 / 48000) / .1)
    samples.extend([taper * (speech + kick + crash), taper * (.7 * speech + kick + .65 * crash)])
if sys.byteorder != "little":
    samples.byteswap()
source = args.output / "source.f32"
source.write_bytes(samples.tobytes())

def execute(name, recipe, output=False):
    path = args.output / (name + ".f32")
    command = [str(args.ffmpeg), "-nostdin", "-hide_banner", "-f", "f32le", "-ar", "48000", "-ac", "2", "-i", str(source), "-af", recipe]
    command += ["-ar", "48000", "-ac", "2", "-c:a", "pcm_f32le", "-f", "f32le", str(path)] if output else ["-f", "null", "-"]
    result = subprocess.run(command, capture_output=True, text=True, timeout=30, check=True)
    (args.output / (name + ".log")).write_text(result.stderr)
    return path, result.stderr

def meter(path):
    result = subprocess.run([str(args.oracle), str(path), "2", "48000"], capture_output=True, text=True, timeout=30, check=True)
    return {k: float(v) if v is not None else None for k, v in json.loads(result.stdout).items()}

base = "loudnorm=I=-14.5:TP=0:LRA=7:linear=false"
_, log = execute("first-pass", base + ":print_format=json")
first = json.JSONDecoder().raw_decode(log[log.rfind("{"):])[0]
frozen = base + ":measured_I=" + first["input_i"] + ":measured_TP=" + first["input_tp"] + ":measured_LRA=" + first["input_lra"] + ":measured_thresh=" + first["input_thresh"]
offset = float(first["target_offset"])
report = {"case": args.case, "before": meter(source), "first": first, "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(), "ffmpegSha256": hashlib.sha256(args.ffmpeg.read_bytes()).hexdigest(), "oracleSha256": hashlib.sha256(args.oracle.read_bytes()).hexdigest(), "attempts": []}
previous_error = math.inf
for candidate in range(3):
    recipe = frozen + ":offset=" + str(offset)
    path, _ = execute("candidate-" + str(candidate), recipe, True)
    measured = meter(path)
    error = abs(measured["integratedLufs"] + 14.5)
    constraints = measured["truePeakDbtp"] <= .15 and measured["loudnessRangeLu"] <= 7.2
    report["attempts"].append({"offsetDb": offset, "recipe": recipe, "after": measured, "outputSha256": hashlib.sha256(path.read_bytes()).hexdigest()})
    admitted = [i for i, attempt in enumerate(report["attempts"]) if abs(attempt["after"]["integratedLufs"] + 14.5) <= .2 and attempt["after"]["truePeakDbtp"] <= .15 and attempt["after"]["loudnessRangeLu"] <= 7.2]
    report["selectedAttempt"] = min(admitted, key=lambda i: abs(report["attempts"][i]["after"]["integratedLufs"] + 14.5)) if admitted else None
    report["admitted"] = bool(admitted)
    (args.output / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    if not constraints or error <= .1 or previous_error - error < .02:
        break
    previous_error = error
    offset += -14.5 - measured["integratedLufs"]
    if not -99 <= offset <= 99:
        break
print(json.dumps(report, indent=2))
if report["admitted"] != (args.case == "balanced"):
    raise SystemExit("Independent strict verdict differs; operands retained")
