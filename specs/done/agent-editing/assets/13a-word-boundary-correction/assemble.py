"""Assemble a listening reference from immutable PCM; no stretch or word inference."""
from pathlib import Path
import hashlib
import json
import math
import struct

out = Path(__file__).resolve().parent
source = out.parent / "13a-short-word/original.wav"
original = source.read_bytes()
digest = lambda data: hashlib.sha256(data).hexdigest()
assert digest(original) == "afb2a082d6712beef71dae54a89060710e62f9ee0db6e69c5e4eae029cf5bb0c"
assert original[36:40] == b"data"
pcm = original[44:]
assert len(pcm) == 231360 * 4
cuts = [31206, 91680]
silence = bytes(24000 * 4)
result_pcm = pcm[:cuts[0]*4] + silence + pcm[cuts[0]*4:cuts[1]*4] + silence + pcm[cuts[1]*4:]
segments = [([0, cuts[0]], [0, cuts[0]]),
            ([cuts[0], cuts[1]], [cuts[0]+24000, cuts[1]+24000]),
            ([cuts[1], 231360], [cuts[1]+48000, 279360])]
for start, end in segments:
    assert pcm[start[0]*4:start[1]*4] == result_pcm[end[0]*4:end[1]*4]
for start in [cuts[0], cuts[1]+24000]:
    assert result_pcm[start*4:(start+24000)*4] == silence
header = bytearray(original[:44])
struct.pack_into("<I", header, 4, len(result_pcm)+36)
struct.pack_into("<I", header, 40, len(result_pcm))
result = header + result_pcm
(out / "boundary-reference.wav").write_bytes(result)
def energy(start, end):
    samples = struct.unpack("<" + "f"*(end-start), pcm[start*4:end*4])
    rms = math.sqrt(sum(x*x for x in samples)/len(samples))
    return {"sourceFrames": [start, end], "rms": rms, "dbfs": 20*math.log10(rms)}
report = {"sourceSha256": digest(original), "outputSha256": digest(result),
          "sampleRate": 48000, "sourceFrames": 231360, "outputFrames": 279360,
          "sourceCutFrames": cuts, "outputPauseStartsSeconds": [cuts[0]/48000, (cuts[1]+24000)/48000],
          "insertedSilenceFramesPerPause": 24000, "segments": segments,
          "rejectedFirstCutFrame": 22560, "firstCutMovedSeconds": (cuts[0]-22560)/48000,
          "energyEvidence": [energy(22560,24480), energy(30960,31440)],
          "boundaryAuthority": "Proposed later low-energy zero crossing only; user word-containment verification PENDING",
          "checks": {"allOriginalSamplesUnchanged": True, "onlyTwoHalfSecondSilencesAdded": True},
          "policy": "No stretch, fade, gain, model or source-range change; all original samples retained in order"}
(out / "report.json").write_text(json.dumps(report, indent=2)+"\n")
