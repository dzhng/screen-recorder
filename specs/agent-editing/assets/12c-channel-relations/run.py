import array,gzip,hashlib,json,math,pathlib,subprocess,time
root=pathlib.Path('/Users/david/dev/screen-recorder');out=pathlib.Path('/tmp/screenrec-denoise-channel-study');base=root/'specs/agent-editing/assets/12c-matched-noise';t=time.monotonic()
h=lambda b:hashlib.sha256(b).hexdigest()
def f(b):
 a=array.array('f');a.frombytes(b);return a
def rms(a):return math.sqrt(sum(x*x for x in a)/len(a))
old=json.loads(gzip.decompress((base/'report.json.gz').read_bytes()))
x=f(gzip.decompress((base/'audio/mixture.f32.gz').read_bytes()));y=f(gzip.decompress((base/'audio/rnnoise-mixture.f32.gz').read_bytes()));assert len(x)==len(y)==240000
assert h(x.tobytes())==old['files']['mixture.f32']['sha256']
assert h(y.tobytes())==old['files']['rnnoise-mixture.f32']['sha256']
exe=pathlib.Path('/tmp/screenrec-rnnoise-api');assert h(exe.read_bytes())=='697657e249b178c415d379511ba4041687055c7cf5d347af80a2d3a08cb6c5ee'
report={'planSha256':h((out/'plan.json').read_bytes()),'baselineInputSha256':h(x.tobytes()),'baselineOutputSha256':h(y.tobytes()),'processorSha256':h(exe.read_bytes()),'cases':[]}
for name,gain in [('identical',1.0),('inverted',-1.0),('half',0.5)]:
 assert time.monotonic()-t<120
 inp=array.array('f',(a*gain for a in x));p=out/(name+'-input.f32');p.write_bytes(inp.tobytes());raw=out/(name+'-raw.f32')
 argv=['/usr/bin/sandbox-exec','-p','(version 1)(allow default)(deny network*)',str(exe),str(p),str(raw),'2'];subprocess.run(argv,check=True,capture_output=True,timeout=30)
 actual=f(raw.read_bytes())[960:960+len(x)];expected=array.array('f',(a*gain for a in y));assert len(actual)==len(x) and all(map(math.isfinite,actual))
 (out/(name+'-output.f32')).write_bytes(actual.tobytes());error=[a-b for a,b in zip(actual,expected)];ratio=rms(actual)/rms(y)
 report['cases'].append({'name':name,'inputGain':gain,'inputSha256':h(inp.tobytes()),'outputSha256':h(actual.tobytes()),'frames':len(actual),'clippedSamples':sum(abs(a)>=1 for a in actual),'differentSamplesFromProportionalOutput':sum(a!=b for a,b in zip(actual,expected)),'maximumAbsoluteProportionalError':max(map(abs,error)),'rmsProportionalError':rms(error),'outputRmsRatio':ratio,'relativeBalanceChangeDb':20*math.log10(ratio/abs(gain)),'command':argv})
report['elapsedSeconds']=time.monotonic()-t;(out/'report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
