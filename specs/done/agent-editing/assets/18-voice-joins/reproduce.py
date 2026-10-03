import json,hashlib,shutil
from pathlib import Path
import numpy as np
from scipy.io import wavfile
root=Path(__file__).resolve().parents[4]
source=root/'specs/agent-editing/assets/18-voice'
levels=json.loads((root/'specs/agent-editing/assets/18-voice-levels/report.json').read_text())
out=root/'specs/agent-editing/assets/18-voice-joins'
manifest=json.loads((source/'manifest.json').read_text())
rate,context=wavfile.read(source/'context.wav')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
report={'userFeedback':'Level-matched clips still have excessive silence before/after insertion and generated voice sounds more echoey.', 'method':'Conservative manually chosen generated-audio crops informed by ASR spoken boundaries; 5ms generated-only edge ramps; same gains as level audition. Original context remains sample-exact. No dereverberation or time stretching.', 'cases':[]}
manifest['runs']=manifest['runs'][:2]
for run,(start,end) in zip(manifest['runs'],[(.12,.84),(0,2.8)]):
 kind=run['id'].removeprefix('same-take-');rr,raw=wavfile.read(source/(run['id']+'.wav'));assert rr==rate
 gain=next(x['gainDb'] for x in levels['cases'] if x['id']==kind)
 first=round(start*rate);last=round(end*rate);clip=(raw[first:last].astype(float)*10**(gain/20)).astype(np.float32)
 ramp=round(.005*rate);clip[:ramp]*=np.linspace(0,1,ramp,dtype=np.float32);clip[-ramp:]*=np.linspace(1,0,ramp,dtype=np.float32)
 join=run['joinsFrames'][0];source_end=join+round(run['targetDurationSeconds']*rate)
 merged=np.concatenate([context[:join],clip,context[source_end:]])
 rawpath=out/(run['id']+'.wav');path=out/(kind+'-tight-context.wav');wavfile.write(rawpath,rate,clip);wavfile.write(path,rate,merged)
 _,saved=wavfile.read(path)
 assert np.array_equal(saved[:join],context[:join]) and np.array_equal(saved[join+len(clip):],context[source_end:])
 assert np.array_equal(saved[join:join+len(clip)],clip) and np.isfinite(saved).all()
 report['cases'].append({'id':kind,'keptGeneratedSeconds':[start,end],'removedHeadSeconds':start,'removedTailSeconds':len(raw)/rate-end,'gainDb':gain,'fadeSeconds':.005,'sourceSha256':sha(source/(run['id']+'.wav')),'outputSha256':sha(path),'originalContextExact':True,'generatedDurationSeconds':len(clip)/rate})
 run['rawSha256']=sha(rawpath);run['durationSeconds']=len(clip)/rate
shutil.copy2(source/'reference.wav',out/'reference.wav')
manifest={'config':{key:manifest['config'][key] for key in ['reference','replacements']},'runs':[{key:run[key] for key in ['id','text','referenceSha256','rawSha256','durationSeconds']} for run in manifest['runs']], 'derivation':'See report.json; crops and gain derive from the frozen 18-voice evidence.'}
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
