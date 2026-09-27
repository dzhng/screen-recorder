from pathlib import Path
import hashlib
import json
import numpy as np
from scipy.io import wavfile

out = Path(__file__).resolve().parent
assets = out.parent
prior = assets / '18-voice-roomtone'
rate, context = wavfile.read(assets / '18-voice/context.wav')
insert_rate, insert = wavfile.read(prior / 'same-take-phrase.wav')
old_rate, old = wavfile.read(prior / 'phrase-room-context.wav')
assert rate == insert_rate == old_rate == 24000
first = round((73748675 - 71500000) * rate / 1e6)
n = 120
trim = round(.12 * rate)
fade = np.linspace(0, 1, n, dtype=np.float32)
# Keep the existing wet insert and every later sample, including the exit join.
merged = np.concatenate([
    old[:first-n],
    context[first-n:first] * (1-fade) + insert[trim:trim+n] * fade,
    old[first+trim:],
])
path = out / 'phrase-shorter-lead-context.wav'
wavfile.write(path, rate, merged)
wavfile.write(out / 'phrase-shorter-lead.wav', rate, insert[trim:])
_, saved = wavfile.read(path)
assert np.array_equal(saved[:first-n], old[:first-n])
assert np.array_equal(saved[first:], old[first+trim:])
assert len(old) - len(saved) == trim
assert np.isfinite(saved).all()
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
report = {
    'trimmedLeadMs': 120,
    'transitionSamples': n,
    'rate': rate,
    'previousContextSha256': sha(prior / 'phrase-room-context.wav'),
    'previousWetInsertSha256': sha(prior / 'same-take-phrase.wav'),
    'outputSha256': sha(path),
    'frames': len(saved),
    'prefixExact': True,
    'entireSuffixAfterEntranceExact': True,
    'suffixComparison': {'newStartFrame': first, 'previousStartFrame': first+trim},
    'method': 'Remove 120ms from the existing wet phrase lead, rebuilding only the 5ms entrance. Retain every later sample exactly, including room tone, gain, exit crossfade and original suffix.'
}
(out / 'report.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(report, indent=2))
