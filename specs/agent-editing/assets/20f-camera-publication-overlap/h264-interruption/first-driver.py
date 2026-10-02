import subprocess,json,datetime,time,hashlib
from pathlib import Path
r=Path('/tmp/screenrec-20f-h264-interruption');s=r/'successor';plans=json.loads((s/'plan.json').read_text());records=[]
for pin in json.loads((s/'immediate-pins.json').read_text()):
 data=Path(pin['path']).read_bytes();assert len(data)==pin['bytes'] and hashlib.sha256(data).hexdigest()==pin['sha256']
for label,args,bound in [('old-compile',plans['baseline'],None),('current-compile',plans['final'],None),('old-publication',[str(s/'baseline-probe'),str(r/'old-case')],30),('current-publication',[str(s/'final-probe'),str(r/'current-case')],30)]:
 with (s/(label+'.stdout')).open('wb') as out,(s/(label+'.stderr')).open('wb') as err:
  t=time.monotonic();p=subprocess.Popen(args,stdout=out,stderr=err);entry=dict(label=label,pid=p.pid,args=args,startedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),boundSeconds=bound);records.append(entry);print(json.dumps(dict(event='spawn',label=label,pid=p.pid)),flush=True)
  try:code=p.wait(timeout=bound)
  except subprocess.TimeoutExpired:p.kill();code=p.wait();entry['timedOut']=True
  entry.update(exitCode=code,elapsedSeconds=time.monotonic()-t);(s/'processes.json').write_text(json.dumps(records,indent=2)+'\n');print(json.dumps(dict(event='terminal',label=label,pid=p.pid,exitCode=code)),flush=True)
  assert code==0 and not entry.get('timedOut')
