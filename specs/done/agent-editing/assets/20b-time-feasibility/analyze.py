from fractions import Fraction as F
from pathlib import Path
import json,math,hashlib
base=Path(__file__).parent
raw=json.loads((base/'observations.json').read_text())
def fraction(s): return F(s['value'],s['timescale'])
def nearest_ns(t):
 n=t.numerator*10**9;d=t.denominator
 return (n+d//2)//d
report={'scope':raw['scope'],'cases':[],'ordinaryCaptureSupportVerified':False}
for source in raw['inputs']:
 rate=source['rate'];rows=source['buffers'];anchor=fraction(source['anchor']);origin=fraction(source['origin'])
 expected_frame=0; strict_runs=1; deltas=[]; roundtrips=[]; exact=[]
 for i,row in enumerate(rows):
  media=fraction(row['mediaPTS']); observed=fraction(row['observedHostPTS'])
  assert row['secondSampleStatus']==0
  assert fraction(row['perSampleDuration'])==F(1,rate)
  assert media==F(expected_frame,rate)
  assert fraction(row['existingMicroRecipePTS'])==100+media
  assert not row['existingMicroRecipePTS']['rounded']
  intended=anchor+media
  assert nearest_ns(intended)==row['observedHostPTS']['value']
  # Same-scale raw-origin subtraction is exact. Keep anchor + frame/rate as a rational pair.
  assert fraction(row['mappedBySameScaleSubtract'])==observed-origin
  exact.append({'index':i,'sourceAnchor':str(anchor-origin),'firstFrame':expected_frame,
                'exactSourceStart':str(intended-origin),'observedSourceStart':str(observed-origin),
                'cmTimeAddErrorNs':str((fraction(row['naiveHostAdd'])-intended)*10**9),
                'secondSampleErrorNs':str((fraction(row['secondSamplePTS'])-(observed+F(1,rate)))*10**9)})
  roundtrips.append(nearest_ns(anchor+F(expected_frame,rate))==row['observedHostPTS']['value'])
  if i:
   previous=rows[i-1]
   delta=observed-fraction(previous['observedHostPTS'])-F(previous['frames'],rate)
   deltas.append(str(delta*10**9));strict_runs+=int(delta!=0)
  expected_frame+=row['frames']
 # The positive control carries explicit nearest-ns provenance; values alone do not supply it.
 assert all(roundtrips)
 mutated=rows[5]['observedHostPTS']['value']+1
 assert nearest_ns(anchor+fraction(rows[5]['mediaPTS']))!=mutated
 # Omit buffer4: no physical-frame accounting rule may conceal its missing sample interval.
 physical_before5=sum(x['frames'] for x in rows[:4])
 assert nearest_ns(anchor+F(physical_before5,rate))!=rows[5]['observedHostPTS']['value']
 report['cases'].append({'rate':rate,'buffers':len(rows),'strictExactRuns':strict_runs,
   'adjacencyDeltaNs':sorted(set(deltas)),'lcmWithNanoseconds':math.lcm(10**9,rate),
   'exceedsCMTimeScale':math.lcm(10**9,rate)>2**31-1,
   'cmTimeAddRoundedBuffers':sum(x['naiveHostAdd']['rounded'] for x in rows),
   'runtimeCMTimeAddScales':sorted(set(x['naiveHostAdd']['timescale'] for x in rows)),
   'knownQuantizerRoundTrips':sum(roundtrips),'oneNanosecondPerturbationRejected':True,
   'omittedBufferDetected':True,'exactAnchorAndFrameRepresentationPreserved':True,
   'observations':exact})
report['inputs']={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in map(lambda x:Path(x['path']),raw['inputs'])}
report['probeSha256']=hashlib.sha256((base/'probe').read_bytes()).hexdigest()
(base/'report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({**report,'cases':[{k:v for k,v in x.items() if k!='observations'} for x in report['cases']]},indent=2))
