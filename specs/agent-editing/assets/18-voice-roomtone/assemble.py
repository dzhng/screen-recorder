from pathlib import Path
import json,hashlib,shutil
import numpy as np
from scipy.io import wavfile
root=Path(__file__).resolve().parent.parent;source=root/'18-voice';out=Path(__file__).resolve().parent
m=json.loads((source/'manifest.json').read_text());levels=json.loads((root/'18-voice-levels/report.json').read_text());rate,context=wavfile.read(source/'context.wav');rr,pause=wavfile.read(out/'pause.wav');assert rr==rate
noise=pause[round(.3*rate):round(1.2*rate)].copy();wavfile.write(out/'room-tone.wav',rate,noise)
def rms(a):return float(np.sqrt(np.mean(a.astype(np.float64)**2)))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def bed(length):
 overlap=round(.05*rate);fade=np.linspace(0,1,overlap,dtype=np.float64);samples=noise.astype(np.float64).copy()
 while len(samples)<length:
  samples=np.concatenate([samples[:-overlap],samples[-overlap:]*(1-fade)+noise[:overlap]*fade,noise[overlap:]])
 samples=samples[:length];return (samples*rms(noise)/rms(samples)).astype(np.float32)
report={'referenceTimelineRangeUs':[66500000,67400000],'sourceOriginUs':48675,'roomToneRmsDbfs':20*np.log10(rms(noise)),'roomToneSha256':sha(out/'room-tone.wav'),'method':'Original preferred voice mode, shorter explicit generated margins, same voice gain. Wet and dry variants differ only by extracted room tone. Room tone loops with 50ms overlaps, at its original RMS. Both use 5ms crossfades into adjacent original context; samples outside those transition windows are exact. No alternative voice model or de-reverberation.','cases':[]};runs=[]
for original,(start,end) in zip(m['runs'][:2],[(.24,.84),(0,2.4)]):
 kind=original['id'].removeprefix('same-take-');rr,raw=wavfile.read(source/(original['id']+'.wav'));assert rr==rate
 gain=next(c['gainDb'] for c in levels['cases'] if c['id']==kind);voice=(raw[round(start*rate):round(end*rate)].astype(float)*10**(gain/20)).astype(np.float32);ambient=bed(len(voice))
 cut_start,cut_end=(74168675,74688675) if kind=='word' else (73748675,74688675)
 first=round((cut_start-71500000)*rate/1e6);last=round((cut_end-71500000)*rate/1e6);n=round(.005*rate);fade=np.linspace(0,1,n,dtype=np.float32)
 entry={'id':kind,'replacedTimelineRangeUs':[cut_start,cut_end],'keptGeneratedSeconds':[start,end],'voiceGainDb':gain,'transitionSamples':n,'roomToneRmsDbfs':20*np.log10(rms(ambient)),'outputs':{}}
 for mode,insert in [('dry',voice),('room',voice+ambient)]:
  merged=np.concatenate([context[:first-n],context[first-n:first]*(1-fade)+insert[:n]*fade,insert[n:-n],insert[-n:]*(1-fade)+context[last:last+n]*fade,context[last+n:]])
  path=out/(kind+'-'+mode+'-context.wav');wavfile.write(path,rate,merged);_,saved=wavfile.read(path)
  assert np.array_equal(saved[:first-n],context[:first-n]);assert np.array_equal(saved[first+len(insert)-n:],context[last+n:]);assert np.isfinite(saved).all();assert len(saved)==len(context)-(last-first)+len(insert)-2*n
  entry['outputs'][mode]={'sha256':sha(path),'frames':len(saved),'outsideTransitionExact':True}
 rawpath=out/(original['id']+'.wav');wavfile.write(rawpath,rate,voice+ambient);runs.append({'id':original['id'],'text':original['text'],'referenceSha256':original['referenceSha256'],'rawSha256':sha(rawpath)})
 report['cases'].append(entry)
shutil.copy2(source/'reference.wav',out/'reference.wav');(out/'manifest.json').write_text(json.dumps({'config':{key:m['config'][key] for key in ['reference','replacements']},'runs':runs},indent=2)+'\n');(out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
