import json,subprocess,time,datetime,hashlib,os,select,sys
from pathlib import Path
root=Path('/tmp/screenrec-23l-native-png-correspondence');plan=json.loads((root/'plan.json').read_text());cases=json.loads((root/'cases.json').read_text());records=[];report={'passed':False,'producerPID':os.getpid(),'cases':[]}
def hashed(p):
 b=p.read_bytes();return {'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def run(label,args,bound=None):
 with (root/(label+'.stdout')).open('wb') as out,(root/(label+'.stderr')).open('wb') as err:
  start=time.monotonic();child=subprocess.Popen(args,stdout=out,stderr=err);entry={'label':label,'args':args,'pid':child.pid,'startedAt':stamp(),'boundSeconds':bound};records.append(entry);print(json.dumps({'event':'spawn','label':label,'pid':child.pid}),flush=True)
  try:code=child.wait(timeout=bound)
  except subprocess.TimeoutExpired:child.kill();code=child.wait();entry['timedOut']=True
  entry.update(exitCode=code,elapsedSeconds=time.monotonic()-start,endedAt=stamp());(root/'processes.json').write_text(json.dumps(records,indent=2)+'\n');print(json.dumps({'event':'terminal','label':label,'pid':child.pid,'exitCode':code}),flush=True);assert code==0 and not entry.get('timedOut')
# The seven named authorities and final changed sources/module already have precise saved pins.
for p,pin in plan['pins'].items():assert hashed(Path(p))==pin,p
run('link',plan['linkArgs'])
run('sign',['codesign','--force','--sign','-','--entitlements','/tmp/screenrec-09c-native-build/arm64-apple-macosx/debug/screenrec-native-entitlement.plist',str(root/'screenrec-native')])
report['worker']=hashed(root/'screenrec-native')
start=time.monotonic();deadline=start+120
nativeErr=(root/'native.stderr').open('wb');rawOut=(root/'native.stdout').open('wb');rawIn=(root/'native.stdin').open('wb')
child=subprocess.Popen([str(root/'screenrec-native')],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=nativeErr);entry={'label':'native','args':[str(root/'screenrec-native')],'pid':child.pid,'startedAt':stamp(),'boundSeconds':120};records.append(entry);report['nativePID']=child.pid;print(json.dumps({'event':'spawn','label':'native','pid':child.pid}),flush=True);pending=b''
try:
 for case in cases:
  ordinal=case['ordinal'];request=case['request'];wire=(json.dumps(request,separators=(',',':'))+'\n').encode();rawIn.write(wire);rawIn.flush();child.stdin.write(wire);child.stdin.flush();requestStart=time.monotonic();requestDeadline=min(deadline,requestStart+30)
  while b'\n' not in pending:
   remain=requestDeadline-time.monotonic();assert remain>0,'Request deadline'
   ready,_,_=select.select([child.stdout],[],[],remain);assert ready,'Request deadline';data=os.read(child.stdout.fileno(),65536);assert data,'Native EOF before response';rawOut.write(data);rawOut.flush();pending+=data
  line,pending=pending.split(b'\n',1);reply=json.loads(line);assert reply['ok'] and reply['id']==request['id'],reply
  data=reply['data'];old=case['originalResponse']['data'];assert {k:v for k,v in data.items() if k not in ['file','bytes']}=={k:v for k,v in old.items() if k not in ['file','bytes']},'Saved metadata mismatch'
  png=root/f'{ordinal:02d}.png';assert data['file']==str(png) and data['bytes']==png.stat().st_size
  result={'ordinal':ordinal,'nativeRowIndex':case['nativeRowIndex'],'sample':data['pictures'][0]['sample'],'metadataEqual':True,'requestElapsedSeconds':time.monotonic()-requestStart,'png':hashed(png),'reference':case['reference']}
  report['cases'].append(result);(root/'report.json').write_text(json.dumps(report,indent=2)+'\n')
  run(f'pixels-{ordinal:02d}',['/tmp/screenrec-21e-image-pixels',str(png),str(root/f'{ordinal:02d}.rgba')],min(30,deadline-time.monotonic()))
  actual=(root/f'{ordinal:02d}.rgba').read_bytes();expected=Path(case['reference']['file']).read_bytes();assert len(actual)==len(expected)==24585600;assert hashlib.sha256(expected).hexdigest()==case['reference']['sha256'];result['rgba']={'bytes':len(actual),'sha256':hashlib.sha256(actual).hexdigest(),'allBytesEqual':actual==expected};assert actual==expected,'Complete RGBA mismatch'
  print(json.dumps({'event':'case','ordinal':ordinal,'metadataEqual':True,'allBytesEqual':True}),flush=True)
 assert not pending,'Unexpected native response bytes'
 report['passed']=True
except BaseException as error:
 report['error']=repr(error)
finally:
 child.stdin.close()
 try:code=child.wait(timeout=max(0.01,min(15,deadline-time.monotonic())))
 except subprocess.TimeoutExpired:child.kill();code=child.wait();entry['timedOut']=True
 rest=child.stdout.read();rawOut.write(rest);rawOut.close();rawIn.close();nativeErr.close();entry.update(exitCode=code,endedAt=stamp(),elapsedSeconds=time.monotonic()-start);report['nativeExitCode']=code;report['outerElapsedSeconds']=time.monotonic()-start
 if code!=0 or entry.get('timedOut') or rest:report['passed']=False;report['cleanupError']='Native nonzero, timeout or unexpected trailing stdout'
 report['authorityUnchanged']=all(hashed(Path(p))==pin for p,pin in plan['pins'].items());report['passed']=report['passed'] and report['authorityUnchanged'];(root/'processes.json').write_text(json.dumps(records,indent=2)+'\n');(root/'report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'event':'terminal','label':'native','pid':child.pid,'exitCode':code,'passed':report['passed']}),flush=True)
sys.exit(0 if report['passed'] else 1)
