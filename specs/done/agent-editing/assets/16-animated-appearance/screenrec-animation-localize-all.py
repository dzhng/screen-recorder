from pathlib import Path
import json,hashlib,subprocess
repo=Path('/Users/david/.codex/worktrees/noise-prepared-output/screen-recorder');base=Path('/tmp/screenrec-animation-complete');out=Path('/tmp/screenrec-animation-localization-all');out.mkdir(exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
source=repo/'specs/agent-editing/assets/10d-still-image-native/sources/png-6.png'
workers={'frozen':'/tmp/screenrec-opacity-integrated-native','finished-canvas':'/tmp/screenrec-border-native','sampling-cells':'/tmp/screenrec-sampling-clamp-native'};results=[]
for name,old in [('pose','16-pose'),('geometry','16-geometry')]:
 report=json.loads((base/name/'report.json').read_text());captures={}
 for p in (base/name/'native').glob('*.json'):
  r=json.loads(p.read_text())
  if r.get('operation')=='media.renderCompositionFrame':captures[sha(p.with_name(p.stem+'-output'))]=r
 seen=set()
 for picture in report['pictures']:
  if picture['sha256'] in seen:continue
  seen.add(picture['sha256']);record=captures[picture['sha256']]
  for label,worker in workers.items():
   request=json.loads(json.dumps(record['request']));request['assets'][0]['path']=str(source);request['output']=str(out/f'{name}-{picture["name"]}-{label}.png');assert request.pop('fonts')==[]
   envelope={'id':'localize','operation':record['operation'],'params':request};(out/f'{name}-{picture["name"]}-{label}.request.json').write_text(json.dumps(envelope,indent=2))
   proc=subprocess.run([worker],input=json.dumps(envelope)+'\n',text=True,capture_output=True,timeout=45);response=json.loads(proc.stdout);assert response['ok'],response
   result={'case':name,'picture':picture['name'],'worker':label,'workerSHA256':sha(Path(worker)),'response':response,'pngSHA256':sha(Path(request['output'])),'currentSHA256':picture['sha256'],'historicalSHA256':sha(repo/'specs/agent-editing/assets'/old/(picture['name']+'.png'))};results.append(result)
(out/'report.json').write_text(json.dumps(results,indent=2))
for name in ['pose','geometry']:
 rows=[r for r in results if r['case']==name];print(name,{label:{'samples':len([r for r in rows if r['worker']==label]),'matchesCurrent':sum(r['pngSHA256']==r['currentSHA256'] for r in rows if r['worker']==label),'matchesHistorical':sum(r['pngSHA256']==r['historicalSHA256'] for r in rows if r['worker']==label)} for label in workers})
