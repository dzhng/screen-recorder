# Original official checkpoint only; no from_pretrained or model acquisition.
import hashlib
import json
import os
from pathlib import Path
import resource
import sys
import time

entry = time.perf_counter()
import numpy as np
import torch
from nemo.collections.asr.models import SortformerEncLabelModel

checkpoint, source, output = map(Path, sys.argv[1:])
with checkpoint.open('rb') as handle:
    model_hash = hashlib.file_digest(handle, 'sha256').hexdigest()
torch.set_num_threads(2)
torch.set_num_interop_threads(2)
model = SortformerEncLabelModel.restore_from(str(checkpoint), map_location=torch.device('cpu'), strict=True)
model.eval()
assert model.device.type == 'cpu'
recipe = {'chunk_len': 340, 'chunk_right_context': 40, 'fifo_len': 40, 'spkcache_update_period': 300, 'spkcache_len': 188}
for key, value in recipe.items():
    setattr(model.sortformer_modules, key, value)
model.sortformer_modules._check_streaming_parameters()
assert int(model._cfg.encoder.subsampling_factor) == 8
pcm = source.read_bytes()
samples = np.frombuffer(pcm, dtype='<f4').copy()
assert samples.size == 480000 and np.isfinite(samples).all()
loaded = time.perf_counter()
with torch.inference_mode():
    segments, probabilities = model.diarize(audio=[samples], sample_rate=16000, batch_size=1, include_tensor_outputs=True, num_workers=0, verbose=False)
finished = time.perf_counter()
assert len(segments) == 1 and len(probabilities) == 1
matrix = probabilities[0].detach().cpu().numpy().reshape(-1, 4)
assert np.isfinite(matrix).all()
raw_segments = []
for line in segments[0]:
    start, end, speaker = line.split()
    raw_segments.append({'speaker': speaker, 'start': float(start), 'end': float(end)})
report = {'segments': raw_segments, 'nativeSegmentLines': segments[0], 'nativeProbabilities': matrix.tolist(), 'probabilityShape': list(matrix.shape), 'sampleRate': 16000, 'sourceFrames': samples.size, 'audioSeconds': samples.size/16000, 'frameSeconds': int(model._cfg.encoder.subsampling_factor)*.01, 'config': recipe, 'postprocessing': {'onset': .5, 'offset': .5, 'pad_onset': 0, 'pad_offset': 0, 'min_duration_on': 0, 'min_duration_off': 0}, 'modelConfig': str(model._cfg), 'modelSha256': model_hash, 'pcmSha256': hashlib.sha256(pcm).hexdigest(), 'coldImportsLoadInputSeconds': loaded-entry, 'inferenceSeconds': finished-loaded, 'peakProcessRSSBytes': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss, 'torch': torch.__version__, 'numpy': np.__version__}
with output.open('x') as handle:
    json.dump(report, handle, indent=2)
