import subprocess,json,datetime,time,hashlib
from pathlib import Path
r=Path('/tmp/screenrec-20f-h264-interruption');s=r/'callback-fix';records=[]
for pin in json.loads((s/'pins.json').read_text()):
 b=Path(pin['path']).read_bytes();assert len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256']
for label,args,bound in [('corrected-current-compile',json.loads((s/'plan.json').read_text()),None),('corrected-current-publication',[str(s/'final-probe'),str(r/'corrected-current-case')],30)]:
 with (s/(label+'.stdout')).open('wb') as out,(s/(label+'.stderr')).open('wb') as err:
  t=time.monotonic();p=subprocess.Popen(args,stdout=out,stderr=err);entry=dict(label=label,pid=p.pid,args=args,startedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),boundSeconds=bound);records.append(entry);print(json.dumps(dict(event='spawn',label=label,pid=p.pid)),flush=True)
  try:code=p.wait(timeout=bound)
  except subprocess.TimeoutExpired:p.kill();code=p.wait();entry['timedOut']=True
  entry.update(exitCode=code,elapsedSeconds=time.monotonic()-t);(s/'processes.json').write_text(json.dumps(records,indent=2)+'\n');print(json.dumps(dict(event='terminal',label=label,pid=p.pid,exitCode=code)),flush=True)
  assert code==0 and not entry.get('timedOut')
