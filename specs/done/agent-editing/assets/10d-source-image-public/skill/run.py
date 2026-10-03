import json, subprocess, pathlib, shlex
root=pathlib.Path('/tmp/screenrec-image-skill-M1kDJn/agent-output')
base=['node','/Users/david/dev/screen-recorder/apps/cli/dist/main.js']
sock='/tmp/screenrec-image-skill-M1kDJn/library/run/service.sock'
def call(label,op,params,output=None):
 p=root/(label+'.request.json');p.write_text(json.dumps(params,indent=2)+'\n')
 args=base+[op,'--socket',sock,'--params','-']
 if output: args+=['--output',str(root/output)]
 with (root/'commands.sh').open('a') as f:f.write(shlex.join(args)+' < '+shlex.quote(str(p))+' > '+shlex.quote(str(root/(label+'.response.json')))+' 2> '+shlex.quote(str(root/(label+'.stderr.txt')))+'\n')
 r=subprocess.run(args,input=p.read_text(),capture_output=True,text=True)
 (root/(label+'.response.json')).write_text(r.stdout);(root/(label+'.stderr.txt')).write_text(r.stderr)
 (root/(label+'.exit.txt')).write_text(str(r.returncode))
 print(label,r.returncode,r.stdout)
 return json.loads(r.stdout)
if __name__=='__main__':
 for name,ext in [('diagram','png'),('card','jpg')]:
  call(name+'-import','asset.import',{'requestId':'fresh-image-skill-'+name,'path':'/tmp/screenrec-image-skill-M1kDJn/input/'+name+'.'+ext})
