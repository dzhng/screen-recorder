import json,hashlib,shutil
from pathlib import Path
import numpy as np
from scipy.io import wavfile
root=Path(__file__).resolve().parent.parent
source=root/'18-voice';out=root/'18-voice-speaker-only'
m=json.loads((source/'manifest.json').read_text());rate,context=wavfile.read(source/'context.wav')
report={'method':'Speaker-embedding-only candidate. Gain matches raw generated RMS to up to two seconds of surrounding original context, then explicit ASR-informed crop and 5ms generated-only ramps. No dereverberation. Acoustic quality and identity need listening.', 'cases':[]};runs=[]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for original,(start,end) in zip(m['runs'][:2],[(.28,.88),(0,2.4)]):
 kind=original['id'].removeprefix('same-take-');rr,raw=wavfile.read(out/(kind+'-raw.wav'));assert rr==rate
 join=original['joinsFrames'][0];source_end=join+round(original['targetDurationSeconds']*rate)
 nearby=np.concatenate([context[max(0,join-2*rate):join],context[source_end:source_end+2*rate]])
 rms=lambda a:np.sqrt(np.mean(a.astype(float)**2));gain=rms(nearby)/rms(raw)
 clip=(raw[round(start*rate):round(end*rate)].astype(float)*gain).astype(np.float32);n=round(.005*rate);clip[:n]*=np.linspace(0,1,n,dtype=np.float32);clip[-n:]*=np.linspace(1,0,n,dtype=np.float32)
 path=out/(kind+'-context.wav');rawpath=out/(original['id']+'.wav');wavfile.write(rawpath,rate,clip);wavfile.write(path,rate,np.concatenate([context[:join],clip,context[source_end:]]))
 _,saved=wavfile.read(path);assert np.array_equal(saved[:join],context[:join]) and np.array_equal(saved[join+len(clip):],context[source_end:]);assert np.array_equal(saved[join:join+len(clip)],clip) and np.isfinite(saved).all()
 report['cases'].append({'id':kind,'keptGeneratedSeconds':[start,end],'gainDb':float(20*np.log10(gain)),'fadeSeconds':.005,'originalContextExact':True,'outputSha256':sha(path),'rawSha256':sha(out/(kind+'-raw.wav'))})
 runs.append({'id':original['id'],'text':original['text'],'rawSha256':sha(rawpath),'referenceSha256':original['referenceSha256']})
shutil.copy2(source/'reference.wav',out/'reference.wav')
(out/'manifest.json').write_text(json.dumps({'config':{key:m['config'][key] for key in ['reference','replacements']},'runs':runs},indent=2)+'\n')
(out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
