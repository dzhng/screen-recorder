import array,gzip,hashlib,json,math,pathlib,subprocess,time
root=pathlib.Path('/Users/david/dev/screen-recorder');out=pathlib.Path('/tmp/screenrec-denoise-transient-study');t=time.monotonic()
sha=lambda b:hashlib.sha256(b).hexdigest()
def f(b):
 a=array.array('f');a.frombytes(b);return a
def rms(a):return math.sqrt(sum(x*x for x in a)/len(a))
base=root/'specs/agent-editing/assets/12c-matched-noise/audio'
ref=f(gzip.decompress((base/'reference.f32.gz').read_bytes()));n=len(ref);assert n==240000
processor=pathlib.Path('/tmp/screenrec-rnnoise-api');assert sha(processor.read_bytes())=='697657e249b178c415d379511ba4041687055c7cf5d347af80a2d3a08cb6c5ee'
noise=[0.0]*n;seed=20903
for center in [24000,72000,120000,168000,216000]:
 for j in range(960):
  seed^=seed<<13&4294967295;seed^=seed>>17;seed^=seed<<5&4294967295;seed&=4294967295
  noise[center+j]=(seed/4294967295*2-1)*(1-abs(2*j/959-1))
scale=rms(ref)/(10**.5*rms(noise));noise=array.array('f',(x*scale for x in noise));mix=array.array('f',(x+y for x,y in zip(ref,noise)))
report={'planSha256':sha((out/'plan.json').read_bytes()),'processorSha256':sha(processor.read_bytes()),'referenceSha256':sha(ref.tobytes()),'frames':n,'runs':{}}
for name,x in [('noise',noise),('mixture',mix)]:
 assert time.monotonic()-t<120 and max(map(abs,x))<1
 inp=out/(name+'.f32');raw=out/(name+'-raw.f32');inp.write_bytes(x.tobytes())
 argv=['/usr/bin/sandbox-exec','-p','(version 1)(allow default)(deny network*)',str(processor),str(inp),str(raw),'2']
 subprocess.run(argv,check=True,timeout=30,capture_output=True)
 y=f(raw.read_bytes())[960:960+n];assert len(y)==n and all(map(math.isfinite,y));(out/(name+'-processed.f32')).write_bytes(y.tobytes())
 error=array.array('f',(a-b for a,b in zip(y,ref))) if name=='mixture' else y
 report['runs'][name]={'command':argv,'inputSha256':sha(x.tobytes()),'outputSha256':sha(y.tobytes()),'outputPeak':max(map(abs,y)),'outputClippedSamples':sum(abs(a)>=1 for a in y),'relativeErrorDb':20*math.log10(rms(error)/rms(noise)),'interpretation':'mixture error against reference, not speech damage score' if name=='mixture' else 'noise-only attenuation, not residual in mixture'}
report['elapsedSeconds']=time.monotonic()-t;(out/'report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
