import subprocess,json,datetime,time
from pathlib import Path
r=Path('/tmp/screenrec-20f-camera-overlap');p=json.loads((r/'candidate-plan.json').read_text());records=[]
for label,args,bound in [('old-damage-compile',json.loads((r/'damage-plan.json').read_text())['baseline'],None),('old-damage',[str(r/'baseline/damage-probe'),str(r/'old-damage')],30),('new-damage-compile',json.loads((r/'damage-plan.json').read_text())['candidate'],None),('new-damage',[str(r/'candidate/damage-probe'),str(r/'new-damage')],30)]:
 with (r/('damage-'+label+'.stdout')).open('wb') as out,(r/('damage-'+label+'.stderr')).open('wb') as err:
  t=time.monotonic();child=subprocess.Popen(args,stdout=out,stderr=err);entry={'label':label,'pid':child.pid,'args':args,'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'boundSeconds':bound};records.append(entry);print(json.dumps({'event':'spawn','label':label,'pid':child.pid}),flush=True)
  try:code=child.wait(timeout=bound)
  except subprocess.TimeoutExpired:child.kill();code=child.wait();entry['timedOut']=True
  entry.update(exitCode=code,elapsedSeconds=time.monotonic()-t);(r/'damage-processes.json').write_text(json.dumps(records,indent=2)+'\n');print(json.dumps({'event':'terminal','label':label,'pid':child.pid,'exitCode':code}),flush=True);assert code==0 and not entry.get('timedOut')
