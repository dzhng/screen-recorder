"""Offline Qwen forced alignment of frozen ASR text, never reference boundaries."""
import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import resource
import signal
import time

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--model', type=Path, required=True)
parser.add_argument('--audio', type=Path, required=True)
parser.add_argument('--transcript', type=Path, required=True)
parser.add_argument('--out', type=Path, required=True)
args = parser.parse_args()
if not (args.model / 'model.safetensors').is_file():
    parser.error('Explicitly prepare the pinned model before running')
args.out.mkdir(parents=True, exist_ok=False)
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
signal.alarm(900)
import soundfile as sf
import torch
from transformers import AutoProcessor, AutoModelForTokenClassification

# Only text enters the model. Existing word timestamps are deliberately discarded.
rows = json.loads(args.transcript.read_text())
text = ' '.join(row['text'] for row in rows if row['type'] == 'word')
audio, rate = sf.read(args.audio, dtype='float32')
if rate != 16000 or audio.ndim != 1:
    parser.error('Use the frozen mono 16 kHz PCM input')
started = time.monotonic()
processor = AutoProcessor.from_pretrained(args.model, local_files_only=True)
model = AutoModelForTokenClassification.from_pretrained(
    args.model, dtype=torch.float16, local_files_only=True).to('mps').eval()
loaded = time.monotonic()
inputs, word_lists = processor.prepare_forced_aligner_inputs(
    audio=audio, transcript=text, language='English')
inputs = inputs.to(model.device, model.dtype)
with torch.inference_mode():
    outputs = model(**inputs)
timestamps = processor.decode_forced_alignment(
    logits=outputs.logits, input_ids=inputs['input_ids'], word_lists=word_lists,
    timestamp_token_id=model.config.timestamp_token_id)[0]
torch.mps.synchronize()
finished = time.monotonic()
result = {'duration': len(audio)/rate, 'words': [
    {'word': item['text'], 'start': item['start_time'], 'end': item['end_time']}
    for item in timestamps]}
(args.out / 'result.json').write_text(json.dumps(result, indent=2)+'\n')
def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()
manifest = {
    'scope': 'Supplied-text timing only; no filler discovery, production or listening acceptance',
    'audioSha256': digest(args.audio), 'transcriptSha256': digest(args.transcript),
    'suppliedTextSha256': hashlib.sha256(text.encode()).hexdigest(),
    'runnerSha256': digest(Path(__file__)),
    'modelFiles': [{'path': str(p.relative_to(args.model)), 'bytes': p.stat().st_size,
                    'sha256': digest(p)} for p in sorted(args.model.rglob('*'))
                   if p.is_file() and '.cache' not in p.parts],
    'runtime': {p.metadata['Name']: p.version for p in importlib.metadata.distributions()},
    'settings': {'device': 'mps', 'dtype': 'float16', 'language': 'English'},
    'loadSeconds': loaded-started, 'alignSeconds': finished-loaded,
    'peakResidentBytes': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
}
(args.out / 'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
print(json.dumps({'state': 'complete', 'words': len(result['words']),
                  'loadSeconds': loaded-started, 'alignSeconds': finished-loaded}))
