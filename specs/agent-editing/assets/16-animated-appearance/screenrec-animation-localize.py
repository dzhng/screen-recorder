from pathlib import Path
import json,hashlib,subprocess
repo=Path('/Users/david/.codex/worktrees/noise-prepared-output/screen-recorder');base=Path('/tmp/screenrec-animation-complete');out=Path('/tmp/screenrec-animation-localization');out.mkdir(exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
source=repo/'specs/agent-editing/assets/10d-still-image-native/sources/png-6.png'
results=[]
workers={'frozen':'/tmp/screenrec-opacity-integrated-native','finished-canvas':'/tmp/screenrec-border-native','sampling-cells':'/tmp/screenrec-sampling-clamp-native','combined':'/tmp/screenrec-caption-output-combined-native'}
for name in ['pose','geometry']:
 target=sha(base/name/'zoom-0.png')
 for p in (base/name/'native').glob('*.json'):
  record=json.loads(p.read_text())
  if record.get('operation')=='media.renderCompositionFrame' and sha(p.with_name(p.stem+'-output'))==target:break
 else:raise AssertionError(name)
 for label,worker in workers.items():
  request=json.loads(json.dumps(record['request']));request['assets'][0]['path']=str(source);request['output']=str(out/f'{name}-{label}.png')
  envelope={'id':'localize','operation':record['operation'],'params':request}
  (out/f'{name}-{label}.request.json').write_text(json.dumps(envelope,indent=2))
  proc=subprocess.run([worker],input=json.dumps(envelope)+'\n',text=True,capture_output=True,timeout=45)
  (out/f'{name}-{label}.response.txt').write_text(proc.stdout+proc.stderr)
  result={'case':name,'worker':label,'workerSHA256':sha(Path(worker)),'response':proc.stdout}
  if Path(request['output']).exists():result['pngSHA256']=sha(Path(request['output']))
  results.append(result)
(out/'report.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))
