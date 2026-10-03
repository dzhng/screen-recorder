import json,time,hashlib
from pathlib import Path
import numpy as np
import mlx.core as mx
from scipy.io import wavfile
from mlx_audio.tts.utils import load_model
root=Path(__file__).resolve().parent.parent/'18-voice'
out=Path(__file__).resolve().parent
m=json.loads((root/'manifest.json').read_text());start=time.perf_counter();model=load_model(__import__("sys").argv[1]);mx.eval(model.parameters());load=time.perf_counter()-start
report={'mode':'speaker embedding only: ref_audio supplied, ref_text omitted','loadSeconds':load,'modelRevision':m['config']['modelRevision'],'runtimeCommit':m['config']['runtimeCommit'],'referenceSha256':m['runs'][0]['referenceSha256'],'seed':18,'runs':[]}
for item in m['config']['replacements']:
 mx.random.seed(18);start=time.perf_counter();args={**m['config']['generation'],'repetition_penalty':1.5}
 results=list(model.generate(text=item['text'],ref_audio=str(root/'reference.wav'),**args))
 raw=np.concatenate([np.asarray(r.audio,dtype=np.float32).reshape(-1) for r in results]);assert np.isfinite(raw).all();assert all(r.sample_rate==24000 for r in results)
 path=out/(item['id']+'-raw.wav');wavfile.write(path,24000,raw)
 report['runs'].append({'id':item['id'],'text':item['text'],'durationSeconds':len(raw)/24000,'seconds':time.perf_counter()-start,'rawSha256':hashlib.sha256(path.read_bytes()).hexdigest()})
 (out/'generation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report['runs'][-1]),flush=True)
