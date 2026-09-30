import sys
import json,statistics,bisect
from pathlib import Path
slivers = len(sys.argv) > 2 and sys.argv[2] == '--slivers'
p=Path(sys.argv[1]);s=json.loads((p/'screen-brightness.json').read_text());c=json.loads((p/'camera-brightness.json').read_text())
v=[sum(f[i] for i in [28,29,36,37])/4 for f in s['grid8x6']];groups=[]
for i,val in enumerate(v):
 if val>150:
  if not groups or i>groups[-1][-1]+1:groups.append([])
  groups[-1].append(i)
se=[]
for g in groups:
 start,end=s['pts'][g[0]],s['pts'][g[-1]]
 if end-start<.3:se.append({'number':round((start-3.7)/5)+1,'pts':start,'prevPts':s['pts'][g[0]-1],'endPts':end})
ce=[]
for event in se:
 target=event['pts']+.38;t=c['pts'];a=bisect.bisect_left(t,target-.25);b=bisect.bisect_right(t,target+.3)
 if a<2 or b>=len(t):continue
 baseline=range(max(0,bisect.bisect_left(t,target-.65)),a)
 if not len(baseline):continue
 bases=[statistics.median(c['grid8x6'][j][cell] for j in baseline) for cell in range(48)]
 scores=[max(c['grid8x6'][j][cell]-bases[cell] for cell in range(24,48)) for j in range(a,b)]
 maximum=max(scores,default=0);onsets=[a+k for k,x in enumerate(scores) if x>(20 if slivers else 60)]
 if maximum>(35 if slivers else 90) and onsets:
  index=onsets[0];cell=max(range(24,48),key=lambda cell:c['grid8x6'][index][cell]-bases[cell]);ce.append({'number':event['number'],'pts':t[index],'prevPts':t[index-1],'maxRise':maximum,'cell':cell,'delta':t[index]-event['pts']})
print('camera',json.dumps(ce,indent=2));(p/('visual-events-sensitive.json' if slivers else 'visual-events.json')).write_text(json.dumps({'screen':se,'cameraCandidates':ce},indent=2))
