import subprocess,json,hashlib,time,array,math,pathlib
root=pathlib.Path(__file__).resolve().parents[4]; out=pathlib.Path('/tmp/screenrec-denoise-reproduction')
out.mkdir(parents=True, exist_ok=True)
ff='/opt/homebrew/bin/ffmpeg'
for label,args in [('version',['-version']),('license',['-L']),('capabilities',['-hide_banner','-h','filter=afftdn'])]:
 p=subprocess.run([ff,*args],capture_output=True,text=True); (out/(label+'.txt')).write_text(p.stdout+p.stderr)
inputs={'reference':root/'specs/agent-editing/assets/18-voice/reference.wav','context':root/'specs/agent-editing/assets/18-voice/context.wav','room-tone':root/'specs/agent-editing/assets/18-voice-roomtone/room-tone.wav'}
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
def pcm(p):
 r=subprocess.run([ff,'-v','error','-i',str(p),'-map','0:a:0','-c:a','pcm_f32le','-f','f32le','-'],capture_output=True,check=True); a=array.array('f');a.frombytes(r.stdout);return a

def stat(a):return {'samples':len(a),'rmsDbfs':20*math.log10(max(1e-30,math.sqrt(sum(x*x for x in a)/len(a)))),'peak':max(abs(x) for x in a),'clippedSamples':sum(abs(x)>=1 for x in a)}
report={'source':{'path':str(root/'fixtures/narrated-workbench/narration.mov'),'sha256':sha(root/'fixtures/narrated-workbench/narration.mov')},'recipe':'afftdn=nr=12:nf=-50:tn=0:tr=0:om=o:ad=0.5:fo=1:nl=min:bm=1.25:gs=0','runs':[]}
for label,source in inputs.items():
 dest=out/(label+'-afftdn.wav');cmd=[ff,'-nostdin','-hide_banner','-y','-i',str(source),'-map','0:a:0','-af',report['recipe'],'-c:a','pcm_f32le',str(dest)]
 start=time.perf_counter();r=subprocess.run(cmd,capture_output=True,text=True,check=True);elapsed=time.perf_counter()-start;(out/(label+'.log')).write_text(r.stderr)
 probe=json.loads(subprocess.run(['/opt/homebrew/bin/ffprobe','-v','error','-show_streams','-of','json',str(source)],capture_output=True,text=True,check=True).stdout)['streams'][0]
 a,b=pcm(source),pcm(dest);sa,sb=stat(a),stat(b)
 report['runs'].append({'id':label,'input':str(source),'inputSha256':sha(source),'output':str(dest),'outputSha256':sha(dest),'command':cmd,'elapsedSeconds':elapsed,'sampleRate':probe['sample_rate'],'channels':probe['channels'],'before':sa,'after':sb,'levelDeltaDb':sb['rmsDbfs']-sa['rmsDbfs'],'note':'Unaligned raw levels; no latency compensation or speech-distortion claim.'})
(out/'report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
