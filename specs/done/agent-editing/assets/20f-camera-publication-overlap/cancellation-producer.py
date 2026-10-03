import subprocess,json,datetime,time
from pathlib import Path
r=Path('/tmp/screenrec-20f-camera-overlap');p=json.loads((r/'candidate-plan.json').read_text());records=[]
for label,args,bound in [('cancellation-compile',json.loads((r/'final-cancellation-plan.json').read_text())['swift'],None),('cancellation',[str(r/'final/cancellation-probe'),str(r/'final-cancellation.json')],30)]:
 with (r/('final-cancel-'+label+'.stdout')).open('wb') as out,(r/('final-cancel-'+label+'.stderr')).open('wb') as err:
  t=time.monotonic();child=subprocess.Popen(args,stdout=out,stderr=err);entry={'label':label,'pid':child.pid,'args':args,'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'boundSeconds':bound};records.append(entry);print(json.dumps({'event':'spawn','label':label,'pid':child.pid}),flush=True)
  try:code=child.wait(timeout=bound)
  except subprocess.TimeoutExpired:child.kill();code=child.wait();entry['timedOut']=True
  entry.update(exitCode=code,elapsedSeconds=time.monotonic()-t);(r/'final-cancel-processes.json').write_text(json.dumps(records,indent=2)+'\n');print(json.dumps({'event':'terminal','label':label,'pid':child.pid,'exitCode':code}),flush=True);assert code==0 and not entry.get('timedOut')
