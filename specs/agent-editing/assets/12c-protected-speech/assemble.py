"""Wrap retained float PCM and exact sample slices in unity-gain WAV headers."""
import gzip
import hashlib
import json
from pathlib import Path
import struct

here = Path(__file__).resolve().parent
assets = here.parent
sha = lambda value: hashlib.sha256(value).hexdigest()
manifest = {"scope": "Retained PCM listening/annotation packet; no inference or listening verdict",
            "sampleRate": 48000, "channels": 1, "gain": 1,
            "labelsConfirmed": False, "files": []}
roles = ["reference", "mixture", "rnnoise-reference", "rnnoise-mixture"]
for cohort, folder in [("original", "12c-matched-noise"), ("clean", "12c-clean-reference/native-level")]:
    root = assets / folder
    report_path = root / "report.json.gz"
    report = json.loads(gzip.decompress(report_path.read_bytes()))
    assert report["sampleRate"] == 48000
    count = report["frames"]
    for role in roles:
        source = root / "audio" / (role + ".f32.gz")
        data = gzip.decompress(source.read_bytes())
        assert sha(data) == report["files"][role + ".f32"]["sha256"]
        assert len(data) == count * 4
        windows = [("whole", 0, count)]
        if cohort == "clean":
            windows += [("start-candidate", 0, 72000), ("end-candidate", count - 72000, count)]
        elif role in ["mixture", "rnnoise-mixture"]:
            windows += [("split-context", 100002, 124002)]
        for name, first, last in windows:
            pcm = data[first * 4:last * 4]
            header = struct.pack("<4sI4s4sIHHIIHH4sI", b"RIFF", 36 + len(pcm), b"WAVE", b"fmt ", 16,
                                 3, 1, 48000, 192000, 4, 32, b"data", len(pcm))
            target = here / f"{cohort}-{role}-{name}.wav"
            target.write_bytes(header + pcm)
            values = [v[0] for v in struct.iter_unpack("<f", pcm)]
            peak = max(abs(v) for v in values)
            assert peak < 1
            manifest["files"].append({"file": target.name, "sha256": sha(header + pcm),
                "source": str(source.relative_to(assets)), "sourceContainerSha256": sha(source.read_bytes()),
                "sourcePcmSha256": sha(data), "report": str(report_path.relative_to(assets)),
                "reportSha256": sha(report_path.read_bytes()), "sourceSampleRange": {"start": first, "end": last},
                "frames": last - first, "pcmSha256": sha(pcm), "unityGainPcmSliceExact": True,
                "peak": peak, "rms": (sum(v * v for v in values) / len(values)) ** 0.5,
                "clippedSamples": sum(abs(v) >= 1 for v in values),
                "alreadyCompensatedByFrames": 960 if role.startswith("rnnoise") else 0})
manifest["generatorSha256"] = sha(Path(__file__).read_bytes())
(here / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(f"Wrote {len(manifest['files'])} exact WAV views without processing")
