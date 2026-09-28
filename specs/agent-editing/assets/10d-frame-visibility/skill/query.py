import json,subprocess,pathlib
ROOT=pathlib.Path('/tmp/screenrec-index-skill-debv36/agent-output')
BASE={'projectId':'8f077c2a-90b8-4239-b6d7-9b5858a276b4','revisionId':'8961ad2b-6d2b-4f39-9f4a-4bc1c214775e'}
def call(op,params,name,output=None):
 p=ROOT/(name+'.params.json');p.write_text(json.dumps(params,indent=2))
 cmd=['node','/Users/david/dev/screen-recorder/apps/cli/dist/main.js',op,'--socket','/tmp/screenrec-index-skill-debv36/library/run/service.sock','--params','-']
 if output:cmd+=['--output',str(ROOT/output)]
 with open(ROOT/'commands.jsonl','a') as f:f.write(json.dumps({'command':cmd,'stdin':str(p)})+'\n')
 r=subprocess.run(cmd,input=p.read_text(),text=True,capture_output=True)
 (ROOT/(name+'.json')).write_text(r.stdout);(ROOT/(name+'.stderr.txt')).write_text(r.stderr)
 print(name,'exit',r.returncode,r.stdout[:25000],r.stderr)
 return json.loads(r.stdout)
if __name__=='__main__':
 call('revision.get',BASE,'revision')
 call('index.get',dict(BASE,limit=2,maxLongEdge=480),'index-0')
