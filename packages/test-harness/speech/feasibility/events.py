"""Research only: explicit local YAMNet/PCM, complete score arrays, no acquisition."""
import gzip
import hashlib
import json
import resource
import sys
import time
from pathlib import Path

entry = time.perf_counter()
import numpy as np
from ai_edge_litert.interpreter import Interpreter

model, pcm, result = map(Path, sys.argv[1:])
waveform = np.frombuffer(pcm.read_bytes(), dtype="<f4")
assert 0 < len(waveform) <= 16000 * 60 and np.isfinite(waveform).all()
interpreter = Interpreter(model_path=str(model), num_threads=2)
interpreter.resize_tensor_input(0, [len(waveform)])
interpreter.allocate_tensors()
interpreter.set_tensor(0, waveform)
loaded = time.perf_counter()
interpreter.invoke()
finished = time.perf_counter()
scores = interpreter.get_tensor(interpreter.get_output_details()[0]["index"])
assert scores.ndim == 2 and scores.shape[1] == 521 and np.isfinite(scores).all()
report = {
    "modelSha256": hashlib.sha256(model.read_bytes()).hexdigest(),
    "pcmSha256": hashlib.sha256(pcm.read_bytes()).hexdigest(),
    "audioSeconds": len(waveform) / 16000,
    "coldImportsModelLoadInputSeconds": loaded - entry,
    "inferenceSeconds": finished - loaded,
    "peakProcessRSSBytes": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
    "maxScores": scores.max(axis=0).tolist(),
    "scoreShape": list(scores.shape),
    "numpy": np.__version__,
    "python": sys.version,
}
with result.open("x") as output:
    json.dump(report, output, indent=2)
with gzip.open(str(result) + ".scores.json.gz", "xb") as output:
    output.write(json.dumps(scores.tolist()).encode())
