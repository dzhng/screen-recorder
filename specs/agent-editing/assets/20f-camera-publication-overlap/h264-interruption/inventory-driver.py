import subprocess,json,datetime,time
from pathlib import Path
r=Path('/tmp/screenrec-20f-h264-interruption');records=[]
fixture='/Users/david/.codex/worktrees/parakeet-model-readiness/screen-recorder/helpers/mac/Tests/ScreenRecorderCaptureTests/fixtures/camera-visible34.mov'
for label,args,bound in [('inspect-compile',json.loads((r/'inspect-plan.json').read_text()),None),('inspect',[str(r/'inspect'),fixture,str(r/'inventory.json')],30)]:
 with (r/(label+'.stdout')).open('wb') as out,(r/(label+'.stderr')).open('wb') as err:
  t=time.monotonic();p=subprocess.Popen(args,stdout=out,stderr=err);entry=dict(label=label,pid=p.pid,args=args,startedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),boundSeconds=bound);records.append(entry);print(json.dumps(dict(event='spawn',label=label,pid=p.pid)),flush=True)
  try:code=p.wait(timeout=bound)
  except subprocess.TimeoutExpired:p.kill();code=p.wait();entry['timedOut']=True
  entry.update(exitCode=code,elapsedSeconds=time.monotonic()-t);(r/'inspect-processes.json').write_text(json.dumps(records,indent=2)+'\n');print(json.dumps(dict(event='terminal',label=label,pid=p.pid,exitCode=code)),flush=True)
  assert code==0 and not entry.get('timedOut')
