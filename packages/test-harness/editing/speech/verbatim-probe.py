"""Offline research-only CrisperWhisper probe; explicit preparation is external.

Never pass labels or reference text to inference. Model outputs stay in the
supplied scratch directory because the pinned weights' research license also
covers outputs. No production engine selection follows from this diagnostic.
"""
import argparse
import dataclasses
import importlib.metadata
import json
import os
from pathlib import Path
import resource
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from model_inventory import file_sha256, model_files

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
manifest = {
    'scope': 'Research diagnostic, no production adoption or listening acceptance',
    'audioSha256': file_sha256(args.audio), 'runnerSha256': file_sha256(Path(__file__)),
    'modelInventorySha256': file_sha256(Path(__file__).resolve().parent.parent / 'model_inventory.py'),
    'modelFiles': model_files(args.model),
    'runtime': {p.metadata['Name']: p.version for p in importlib.metadata.distributions()},
    'settings': {'backend': 'transformers', 'device': 'mps', 'compute_type': 'float16',
                 'language': 'en', 'mode': 'verbatim', 'word_timestamps': True},
    'loadSeconds': loaded-started, 'transcribeSeconds': finished-loaded,
    'peakResidentBytes': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
}
(args.out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'state': 'complete', 'words': len(result.words or []),
                  'loadSeconds': loaded-started, 'transcribeSeconds': finished-loaded}))
