"""Reproduce corrected selections in a new scratch directory; preserve frozen inputs."""
from pathlib import Path
import hashlib
import json
import math
import shutil
import struct
import subprocess
import sys

root = Path(__file__).resolve().parents[4]
out = Path(sys.argv[1]).resolve()
out.mkdir(parents=True, exist_ok=False)
source = root / "specs/agent-editing/assets/13a-short-word/original.wav"
worker = root / "helpers/stretch/.build/release/StretchParity"
clock = root / "packages/composition/src/sample-clock.ts"
measurements = root / "packages/test-harness/editing/stretch-measurements.mjs"
sha = lambda b: hashlib.sha256(b).hexdigest()
original, frozen = source.read_bytes(), worker.read_bytes()
assert sha(original) == "afb2a082d6712beef71dae54a89060710e62f9ee0db6e69c5e4eae029cf5bb0c"
assert sha(frozen) == "1cf7c24c73ba4b6ca3c05aa41fdccb07d62a5ea8ce65c66236bdf4b75743addc"
assert original[36:40] == b"data"
assert struct.unpack_from("<HHIIHH", original, 20) == (3, 1, 48000, 192000, 4, 32)
pcm = original[44:]
assert len(pcm) == 231360 * 4
cases = [("internal-slower-0.8x", 31206, 91680, 4, 5),
         ("internal-slower-0.9x", 31206, 91680, 9, 10),
         ("internal-faster-1.25x", 31206, 91680, 5, 4),
         ("opening-slower-0.8x", 0, 31206, 4, 5),
         ("identity", 31206, 91680, 1, 1)]
clock_code = '''import { readFileSync } from "node:fs";
import { sampleAt } from "./packages/composition/src/sample-clock.ts";
console.log(JSON.stringify(JSON.parse(readFileSync(0,"utf8")).map(([name,a,b,n,d])=>{
  [a,b,n,d]=[a,b,n,d].map(BigInt);
  const start=sampleAt({numerator:a*1000000n,denominator:48000n},48000);
  const end=sampleAt({numerator:(a*n+(b-a)*d)*1000000n,denominator:48000n*n},48000);
  return {name,start,end,frames:end-start};
})));'''
declared = json.loads(subprocess.check_output(["bun", "-e", clock_code],
    input=json.dumps(cases), text=True, cwd=root, timeout=30))
commands, results = [], []
def render(name, data, start, end, wanted):
    inp, dest = out / (name+"-input.f32"), out / (name+".f32")
    inp.write_bytes(data)
    args = [str(worker), str(inp), str(dest), str(start), str(end), str(wanted), "48000"]
    run = subprocess.run(args, capture_output=True, text=True, timeout=60)
    commands.append({"args": args, "exitCode": run.returncode, "stdout": run.stdout, "stderr": run.stderr})
    (out / "commands.json").write_text(json.dumps(commands, indent=2)+"\n")
    assert run.returncode == 0, run.stderr
    result = dest.read_bytes()
    assert len(result) == wanted*4
    assert all(math.isfinite(x[0]) for x in struct.iter_unpack("<f", result))
    return result
def wav(path, data):
    header = bytearray(original[:44])
    struct.pack_into("<I", header, 4, len(data)+36)
    struct.pack_into("<I", header, 40, len(data))
    path.write_bytes(header+data)
for (name, start, end, n, d), count in zip(cases, declared):
    wanted = count["frames"]
    result = render(name, pcm, start, end, wanted)
    selected = pcm[start*4:end*4]
    poison = bytearray(pcm)
    for i in range(231360):
        if i < start or i >= end:
            struct.pack_into("<f", poison, i*4, 0.9 if i%2 else -0.9)
    assert render(name+"-poison", poison, start, end, wanted) == result
    assert render(name+"-selected-only", selected, 0, end-start, wanted) == result
    candidate = pcm[:start*4] + result + pcm[end*4:]
    assert candidate[:start*4] == pcm[:start*4]
    assert candidate[(start+wanted)*4:] == pcm[end*4:]
    if name == "identity":
        assert result == selected and candidate == pcm
        continue
    wav(out / (name+".wav"), candidate)
    tone = b"".join(struct.pack("<f", 0.2*math.sin(2*math.pi*120*i/48000)) for i in range(end-start))
    tone_out = render(name+"-tone", tone, 0, end-start, wanted)
    pitch_code = '''import {readFileSync} from "node:fs";
import {tonePitch, requirePitchAcceptance} from "./packages/test-harness/editing/stretch-measurements.mjs";
const value=tonePitch(readFileSync(process.argv[1]),120);
requirePitchAcceptance(value,"corrected-selected-count");console.log(JSON.stringify(value));'''
    pitch = json.loads(subprocess.check_output(["node", "--input-type=module", "-e", pitch_code,
        str(out/(name+"-tone.f32"))], cwd=root, text=True, timeout=30))
    results.append({"path": name+".wav", "sourceFrames": [start,end],
        "rate": {"numerator": n,"denominator": d}, "declaredOutput": count,
        "outputFrames": len(candidate)//4, "joinsSeconds": [start/48000,(start+wanted)/48000],
        "selectedPcmSha256": sha(result), "tonePitch": pitch,
        "checks": {"exactCount": True,"finite": True,"unchangedPrefix": True,
                   "unchangedSuffix": True,"excludedPoisonIdentical": True,"selectedOnlyIdentical": True}})
assert source.read_bytes() == original and worker.read_bytes() == frozen
(out/"original.wav").write_bytes(original)
shutil.copyfile(__file__, out/"render.py")
report = {"sourceSha256": sha(original), "workerSha256": sha(frozen),
    "clockOwnerSha256": sha(clock.read_bytes()), "pitchOwnerSha256": sha(measurements.read_bytes()),
    "boundaryReferenceSha256": "984e1ef8b9e48053b495fab3980583b724b8059f0849e2db889de46e26f789a1",
    "boundaryAuthority": "User accepted revised paused-reference placement; no sample-exact phonetic edge claim",
    "sampleRate": 48000, "identityExact": True, "results": results,
    "policy": "Same frozen recipe and exact selections; no inserted pauses, denoise, ambience, gain, fades or hidden context",
    "listening": "PENDING for these changed selections; prior files keep their own verdicts", "files": []}
for path in sorted(out.iterdir()):
    if path.suffix == ".wav" or path.name in ["render.py", "commands.json"] or path.name.endswith("-tone.f32"):
        data = path.read_bytes()
        report["files"].append({"path": path.name,"bytes": len(data),"sha256": sha(data)})
(out/"report.json").write_text(json.dumps(report, indent=2)+"\n")
print(json.dumps({"output":str(out),"cases":len(results),"declared":declared}))
