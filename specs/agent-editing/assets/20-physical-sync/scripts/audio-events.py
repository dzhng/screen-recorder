import sys
import json,math,array
from pathlib import Path
root=Path(sys.argv[1]);out=Path(sys.argv[2])
pcm=open(out/'microphone-packed.f32','rb')
weights={freq:([math.cos(2*math.pi*freq*k/8000) for k in range(80)],[math.sin(2*math.pi*freq*k/8000) for k in range(80)]) for freq in [700,1000,1300]}
rows=[]
while True:
 b=pcm.read(1920)
 if not b:break
 if len(b)<1920:break
 a=array.array('f');a.frombytes(b);a=a[::6];ss=sum(v*v for v in a);ratios={}
 for freq,(c,s) in weights.items():
  real=sum(v*w for v,w in zip(a,c));imag=sum(v*w for v,w in zip(a,s));ratios[freq]=2*(real*real+imag*imag)/(80*ss) if ss else 0
 rows.append({'packedTime':len(rows)*.01,'rms':math.sqrt(ss/80),'ratios':ratios})
pcm.close()
journal=[json.loads(x) for x in (root/'screen/capture.journal.jsonl').read_text().splitlines()]
track=next(x['data'] for x in journal if x['event']=='pcmTrack');phase=int(track['phaseUs'])/1e6
runs=[x['data'] for x in journal if x['event']=='pcmAppend'];rate=track['rate'];gaps=[]
for prev,cur in zip(runs,runs[1:]):
 if int(cur['declaredFirstFrame'])!=int(prev['declaredFirstFrame'])+int(prev['frameCount']):gaps.append([prev,cur])
def source(t):
 frame=round(t*rate)
 for r in runs:
  lo=int(r['physicalFirstFrame']);hi=lo+int(r['frameCount'])
  if lo<=frame<hi:return phase+(int(r['declaredFirstFrame'])+frame-lo)/rate
 raise ValueError(frame)
groups=[]
for r in rows:
 if r['rms']>.0001 and r['ratios'][1000]>.5:
  if not groups or r['packedTime']-groups[-1][-1]['packedTime']>.020001:groups.append([])
  groups[-1].append(r)
events=[]
for group in groups:
 if len(group)<3:continue
 t=group[0]['packedTime'];events.append({'packedTime':t,'sourceTime':source(t),'duration':group[-1]['packedTime']+.01-t,'peakRatio1000':max(r['ratios'][1000] for r in group),'maxControl700':max(r['ratios'][700] for r in group),'maxControl1300':max(r['ratios'][1300] for r in group)})
(out/'audio-analysis.json').write_text(json.dumps({'phase':phase,'journalRunCount':len(runs),'gaps':gaps,'events':events,'threshold':{'rms':.0001,'ratio1000':.5,'minWindows':3},'rows':rows}))
print(json.dumps({'phase':phase,'runCount':len(runs),'gaps':len(gaps),'events':events},indent=2))
