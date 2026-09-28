"""Offline research-only CrisperWhisper probe; explicit preparation is external.

Never pass labels or reference text to inference. Model outputs stay in the
supplied scratch directory because the pinned weights' research license also
covers outputs. No production engine selection follows from this diagnostic.
"""
import argparse
import dataclasses
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import resource
import time

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--model', type=Path, required=True)
parser.add_argument('--audio', type=Path, required=True)
parser.add_argument('--out', type=Path, required=True)
args = parser.parse_args()
if not (args.model / 'model.safetensors').is_file():
    parser.error('Explicitly prepare the pinned local model before running')
args.out.mkdir(parents=True, exist_ok=False)
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
from crisperwhisper import CrisperWhisperModel

started = time.monotonic()
model = CrisperWhisperModel(str(args.model.resolve()), backend='transformers',
                           device='mps', compute_type='float16')
loaded = time.monotonic()
result = model.transcribe(str(args.audio.resolve()), language='en',
                          mode='verbatim', word_timestamps=True)
finished = time.monotonic()
(args.out / 'result.json').write_text(json.dumps(dataclasses.asdict(result), indent=2) + '\n')
def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()
manifest = {
    'scope': 'Research diagnostic, no production adoption or listening acceptance',
    'audioSha256': digest(args.audio), 'runnerSha256': digest(Path(__file__)),
    'modelFiles': [{'path': str(p.relative_to(args.model)), 'bytes': p.stat().st_size,
                    'sha256': digest(p)} for p in sorted(args.model.rglob('*'))
                   if p.is_file() and '.cache' not in p.parts],
    'runtime': {p.metadata['Name']: p.version for p in importlib.metadata.distributions()},
    'settings': {'backend': 'transformers', 'device': 'mps', 'compute_type': 'float16',
                 'language': 'en', 'mode': 'verbatim', 'word_timestamps': True},
    'loadSeconds': loaded-started, 'transcribeSeconds': finished-loaded,
    'peakResidentBytes': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
}
(args.out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'state': 'complete', 'words': len(result.words or []),
                  'loadSeconds': loaded-started, 'transcribeSeconds': finished-loaded}))
