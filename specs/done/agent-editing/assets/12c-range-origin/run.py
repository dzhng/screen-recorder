import array,gzip,hashlib,json,pathlib,subprocess,time
repo=pathlib.Path('/Users/david/dev/screen-recorder');out=pathlib.Path('/tmp/screenrec-denoise-range-origin');base=repo/'specs/agent-editing/assets/12c-matched-noise';t=time.monotonic()
h=lambda b:hashlib.sha256(b).hexdigest()
def f(b):
 a=array.array('f');a.frombytes(b);return a
old=json.loads(gzip.decompress((base/'report.json.gz').read_bytes()));x=f(gzip.decompress((base/'audio/mixture.f32.gz').read_bytes()));y=f(gzip.decompress((base/'audio/rnnoise-mixture.f32.gz').read_bytes()))
assert h(x.tobytes())==old['files']['mixture.f32']['sha256'];assert h(y.tobytes())==old['files']['rnnoise-mixture.f32']['sha256']
exe=pathlib.Path('/tmp/screenrec-rnnoise-api');assert h(exe.read_bytes())=='697657e249b178c415d379511ba4041687055c7cf5d347af80a2d3a08cb6c5ee'
start,end=144000,192000;expected=y[start:end];(out/'expected.f32').write_bytes(expected.tobytes());report={'planSha256':h((out/'plan.json').read_bytes()),'sourceSha256':h(x.tobytes()),'fullOutputSha256':h(y.tobytes()),'processorSha256':h(exe.read_bytes()),'requestFrames':[start,end],'cases':[]}
for before in [0,48000,144000]:
 assert time.monotonic()-t<120
 origin=start-before;assert origin%480==0
 inp=out/f'before-{before}-input.f32';raw=out/f'before-{before}-raw.f32';inp.write_bytes(x[origin:].tobytes())
 argv=['/usr/bin/sandbox-exec','-p','(version 1)(allow default)(deny network*)',str(exe),str(inp),str(raw),'2'];subprocess.run(argv,check=True,capture_output=True,timeout=30)
 actual=f(raw.read_bytes())[960+before:960+before+end-start];assert len(actual)==len(expected);(out/f'before-{before}-window.f32').write_bytes(actual.tobytes())
 report['cases'].append({'prehistoryFrames':before,'inputOriginFrame':origin,'inputSha256':h(inp.read_bytes()),'windowSha256':h(actual.tobytes()),'differentSamples':sum(a!=b for a,b in zip(actual,expected)),'maximumAbsoluteDifference':max(abs(a-b) for a,b in zip(actual,expected)),'command':argv})
assert report['cases'][-1]['differentSamples']==0
report['elapsedSeconds']=time.monotonic()-t;(out/'report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
