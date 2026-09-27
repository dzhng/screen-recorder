"""Offline bounded reproduction. This is experiment evidence, not a production voice worker."""
import hashlib
import importlib.metadata
import json
import platform
import resource
import sys
import time
from pathlib import Path

started = time.perf_counter()
import mlx.core as mx
import numpy as np
from scipy.io import wavfile
from mlx_audio.tts.utils import load_model

config_path, model_path, output_path, root = map(Path, sys.argv[1:])
config = json.loads(config_path.read_text())
out = output_path

def sha(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while block := stream.read(1024 * 1024):
            digest.update(block)
    return digest.hexdigest()

manifest = {
    "config": config,
    "sourceSha256": sha(root / config["source"]),
    "requestSha256": sha(config_path),
    "runnerSha256": sha(Path(__file__)),
    "platform": platform.platform(), "python": sys.version,
    "device": mx.metal.device_info(),
    "dependencies": {d.metadata["Name"]: d.version for d in importlib.metadata.distributions()},
    "modelFiles": {str(p.relative_to(model_path)): sha(p) for p in sorted(model_path.rglob("*")) if p.is_file() and ".cache" not in p.parts},
    "network": "OS sandbox deny network plus Hugging Face/Transformers offline flags",
    "originEvidence": "All origins are copies of the same selected actual narration. External-file path is real; past-project asset admission/deletion retention is simulated and NOT verified.",
    "quality": {"requestedWords": "unverified", "identity": "unverified", "delivery": "unverified", "spliceListening": "unverified", "visualReview": "unverified"},
    "runs": [],
}
manifest["preparationAndImportSeconds"] = time.perf_counter() - started
load_start = time.perf_counter()
model = load_model(str(model_path))
mx.eval(model.parameters())
manifest["modelLoadSeconds"] = time.perf_counter() - load_start
rate, context = wavfile.read(out / "context.wav")
assert rate == 24000
for origin in config["origins"]:
    for replacement in config["replacements"]:
        name = f'{origin}-{replacement["id"]}'
        mx.random.seed(config["seed"])
        mx.reset_peak_memory()
        start = time.perf_counter()
        results = list(model.generate(text=replacement["text"], ref_audio=str(out / f"{origin}.wav"), ref_text=config["reference"]["text"], **config["generation"]))
        audio = np.concatenate([np.asarray(result.audio, dtype=np.float32).reshape(-1) for result in results])
        elapsed = time.perf_counter() - start
        assert all(result.sample_rate == rate for result in results)
        assert audio.size and np.isfinite(audio).all()
        raw = out / f"{name}.wav"
        wavfile.write(raw, rate, audio)
        start_frame = round((replacement["range"]["startUs"] - config["contextRange"]["startUs"]) * rate / 1e6)
        end_frame = round((replacement["range"]["endUs"] - config["contextRange"]["startUs"]) * rate / 1e6)
        spliced = np.concatenate([context[:start_frame], audio, context[end_frame:]])
        splice = out / f"{name}-context.wav"
        wavfile.write(splice, rate, spliced)
        run = {
            "id": name, "text": replacement["text"], "referenceSha256": sha(out / f"{origin}.wav"),
            "warm": bool(manifest["runs"]), "generationSeconds": elapsed,
            "coldLoadAndGenerationSeconds": None if manifest["runs"] else manifest["modelLoadSeconds"] + elapsed,
            "durationSeconds": len(audio) / rate, "rtf": elapsed / (len(audio) / rate),
            "mlxPeakBytes": mx.get_peak_memory(), "processPeakRssBytes": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
            "rawSha256": sha(raw), "contextSha256": sha(splice),
            "joinsFrames": [start_frame, start_frame + len(audio)],
            "targetDurationSeconds": (end_frame - start_frame) / rate,
            "durationDeltaSeconds": (len(audio) - (end_frame - start_frame)) / rate,
            "samplePeak": float(np.max(np.abs(audio))),
            "generationSamples": len(audio),
        }
        manifest["runs"].append(run)
        (out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
        print(json.dumps(run), flush=True)
