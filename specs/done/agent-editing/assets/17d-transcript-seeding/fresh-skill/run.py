import json,subprocess,pathlib
D=pathlib.Path('/tmp/screenrec-seed-fresh-skill')
CLI='/Users/david/.codex/worktrees/project-still-composition/screen-recorder/apps/cli/dist/main.js'
SOCKET=json.load(open('/tmp/seed-skill-service.json'))['socketPath']
def call(name,op,p,output=None):
 s=json.dumps(p); (D/(name+'.request.json')).write_text(s)
 args=['node',CLI,op,'--socket',SOCKET,'--params','-']
 if output: args+=['--output',str(D/output)]
 r=subprocess.run(args,input=s,text=True,capture_output=True)
 (D/(name+'.receipt.json')).write_text(r.stdout)
 (D/(name+'.stderr')).write_text(r.stderr)
 print(name,r.returncode,r.stdout)
 return json.loads(r.stdout)
def read(n): return json.load(open(D/(n+'.receipt.json')))
def schema(op): return json.load(open(D/('help-'+op+'.json')))['operations'][0]['inputSchema']
if __name__=='__main__':
 call('models','model.status',{})
 call('import-audio','asset.import',{'requestId':'fresh-seed-audio','path':'/Users/david/dev/screen-recorder/fixtures/narrated-workbench/narration.mov'})
 call('import-font','asset.import',{'requestId':'fresh-seed-font','path':'/System/Library/Fonts/Supplemental/Arial.ttf'})
 call('create','project.create',{'requestId':'fresh-seed-project','title':'Fresh skill seed verification','canvas':{'width':960,'height':540,'fps':{'numerator':30,'denominator':1},'background':'#182030ff'}})
