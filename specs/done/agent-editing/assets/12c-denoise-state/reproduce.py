import pathlib,subprocess,array,math,json,time,hashlib
root=pathlib.Path('/tmp/screenrec-denoise-state-reproduction'); root.mkdir(parents=True, exist_ok=True); ff='/opt/homebrew/bin/ffmpeg'; source=str(pathlib.Path(__file__).resolve().parents[1]/'18-voice/context.wav'); recipe='afftdn=nr=12:nf=-50:tn=0:tr=0:om=o:ad=0.5:fo=1:nl=min:bm=1.25:gs=0'; commands=[]
def run(args):
 cmd=[ff,'-nostdin','-v','error','-y',*args]; commands.append(cmd); t=time.perf_counter(); p=subprocess.run(cmd,capture_output=True,check=True);return p.stdout,time.perf_counter()-t
def read(p):
 b,_=run(['-i',str(p),'-f','f32le','-c:a','pcm_f32le','-']); a=array.array('f');a.frombytes(b);return a

def process(name,inp,start=None,end=None,raw=False):
 filters=[]
 if start is not None:filters += [f'atrim=start_sample={start}:end_sample={end}','asetpts=PTS-STARTPTS']
 filters += [recipe]; dest=root/(name+'.wav')
 _,seconds=run([*(['-f','f32le','-ar','24000','-ac','1'] if raw else []),'-i',str(inp),'-af',','.join(filters),'-c:a','pcm_f32le',str(dest)])
 return read(dest),seconds

def compare(a,b):
 n=min(len(a),len(b)); delta=[a[i]-b[i] for i in range(n)];return {'samplesA':len(a),'samplesB':len(b),'differingSamples':sum(v!=0 for v in delta),'maxAbsoluteError':max(map(abs,delta),default=0),'rmsError':math.sqrt(sum(v*v for v in delta)/max(n,1))}
original=read(source);whole,t=process('whole',source);left,tl=process('left',source,0,60000);right,tr=process('right',source,60000,120000);late,tt=process('late',source,96000,120000)
report={'recipe':recipe,'input':source,'inputSha256':hashlib.sha256(pathlib.Path(source).read_bytes()).hexdigest(),'counts':{'input':len(original),'whole':len(whole),'left':len(left),'right':len(right),'late':len(late)},'seconds':{'whole':t,'left':tl,'right':tr,'late':tt},'wholeVsProcessedHalves':compare(whole,left+right),'rightVsWholeTail':compare(whole[60000:],right),'lateVsWholeTail':compare(whole[96000:],late),'boundaryWindows':{}}
for start,end in [(0,600),(59400,60000),(60000,60600),(60600,61200),(62400,64800),(117600,120000)]: report['boundaryWindows'][f'{start}:{end}']=compare(whole[start:end],(left+right)[start:end])
report['impulses']=[]
for at in [0,2400,23999]:
 a=array.array('f',[0.0])*24000;a[at]=0.5; inp=root/f'impulse-{at}.f32';inp.write_bytes(a.tobytes());b,seconds=process(f'impulse-{at}',inp,raw=True)
 peak=max(range(len(b)),key=lambda i:abs(b[i]));active=[i for i,v in enumerate(b) if abs(v)>1e-6]
 report['impulses'].append({'inputSamples':len(a),'outputSamples':len(b),'at':at,'peakAt':peak,'peak':b[peak],'peakLagSamples':peak-at,'above1e-6First':active[0] if active else None,'above1e-6Last':active[-1] if active else None,'energy':sum(v*v for v in b),'seconds':seconds})
report['commands']=commands;(root/'report.json').write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='commands'},indent=2))
