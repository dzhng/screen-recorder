import pathlib,subprocess,struct,json,hashlib
p=pathlib.Path('/tmp/screenrec-fractional-clock')
def decode(name):
 b=subprocess.check_output(['ffmpeg','-v','error','-nostdin','-i',str(p/(name+'.wav')),'-f','f32le','-'],timeout=30)
 return b,struct.unpack('<'+'f'*(len(b)//4),b)
full,a=decode('full');late,b=decode('late');start=7800011*48000//1000000;end=8200037*48000//1000000
r={'fullFrames':len(full)//8,'lateFrames':len(late)//8,'lateSampleRange':[start,end],'lateEqualsFullSlice':late==full[start*8:end*8],'peaks':[]}
for target in [96000,384000]:
 frame=max(range(target-20,target+21),key=lambda i:abs(a[i*2]))
 r['peaks'].append({'declaredOutputFrame':target,'observedPeakFrame':frame,'differenceFromDeclared':frame-target,'amplitude':a[frame*2]})
frame=max(range((384000-start)-20,(384000-start)+21),key=lambda i:abs(b[i*2]))
r['latePeakAbsoluteFrame']=frame+start
r['betweenPeakFrames']=r['peaks'][1]['observedPeakFrame']-r['peaks'][0]['observedPeakFrame']
r['expectedBetweenPeakFrames']=288000
r['rangeMaximumSampleDifference']=max(abs(x-y)for x,y in zip(b,a[start*2:end*2]))
r['fullPCMHash']=hashlib.sha256(full).hexdigest();r['latePCMHash']=hashlib.sha256(late).hexdigest()
print(json.dumps(r,indent=2))
