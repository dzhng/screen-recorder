"""Research only: original pinned PANNs source and local checkpoint/PCM."""
import hashlib
import importlib.util
import json
import resource
import sys
import time
from pathlib import Path

entry = time.perf_counter()
import numpy as np
import torch

source, model, pcm, result = map(Path, sys.argv[1:])
sys.path.insert(0, str(source.parent))
spec = importlib.util.spec_from_file_location("pinned_panns", source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
assert hashlib.md5(model.read_bytes()).hexdigest() == "e25e26b84585b14c7754c91e48efc9be"
torch.set_num_threads(2)
waveform = np.frombuffer(pcm.read_bytes(), dtype="<f4").copy()
assert 0 < len(waveform) <= 32000 * 60 and np.isfinite(waveform).all()
network = module.Cnn6(32000, 1024, 320, 64, 50, 14000, 527)
network.load_state_dict(torch.load(model, map_location="cpu", weights_only=True)["model"])
network.eval()
loaded = time.perf_counter()
with torch.inference_mode():
    scores = network(torch.from_numpy(waveform)[None])["clipwise_output"][0].numpy()
finished = time.perf_counter()
assert scores.shape == (527,) and np.isfinite(scores).all()
report = {
    "modelSha256": hashlib.sha256(model.read_bytes()).hexdigest(),
    "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
    "pcmSha256": hashlib.sha256(pcm.read_bytes()).hexdigest(),
    "audioSeconds": len(waveform) / 32000,
    "coldImportsModelLoadInputSeconds": loaded - entry,
    "inferenceSeconds": finished - loaded,
    "peakProcessRSSBytes": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
    "scores": scores.tolist(),
    "numpy": np.__version__,
    "torch": torch.__version__,
    "python": sys.version,
}
with result.open("x") as output:
    json.dump(report, output, indent=2)
