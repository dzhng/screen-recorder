"""Verify retained research audio without importing a synthesis model."""
import hashlib,json,sys
from pathlib import Path
import numpy as np
from scipy.io import wavfile
out=Path(sys.argv[1]); m=json.loads((out/'manifest.json').read_text())
sha=lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
rate,context=wavfile.read(out/'context.wav')
checks=[]
for r in m['runs']:
 _,raw=wavfile.read(out/(r['id']+'.wav')); _,splice=wavfile.read(out/(r['id']+'-context.wav'))
 assert sha(out/(r['id']+'.wav'))==r['rawSha256']
 assert sha(out/(r['id']+'-context.wav'))==r['contextSha256']
 first,last=r['joinsFrames']; source_end=first+round(r['targetDurationSeconds']*rate)
 assert np.array_equal(splice[:first],context[:first])
 assert np.array_equal(splice[first:last],raw)
 assert np.array_equal(splice[last:],context[source_end:])
 assert len(splice)==len(context)-round(r['targetDurationSeconds']*rate)+len(raw)
 assert np.isfinite(splice).all()
 checks.append(r['id'])
print(json.dumps({'verified':checks,'assertions':'Output hashes; exact retained prefix/suffix; exact inserted PCM; count conservation; finite samples. No listening claim.'},indent=2))
