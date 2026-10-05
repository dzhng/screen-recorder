import hashlib,json,os,signal,subprocess,time,sys
from pathlib import Path
r=Path('/tmp/screenrec-nemo-original-evidence');p=json.loads((r/'frozen-protocol.json').read_text());audit=json.loads(Path('/tmp/screenrec-parity-speaker-cohort/specs/ffmpeg-parity/evidence/speaker-cohort/input-audit.json').read_text());id=sys.argv[1] if len(sys.argv)>1 else 'bspxd';case=next(c for c in audit['cases'] if c['id']==id)
order=['bspxd','ccokr','cmfyw','aepyx','aggyz','aiqwk'];assert id in order
for previous in order[:order.index(id)]:assert json.loads((r/(previous+'-score.json')).read_text())['passed']
def sha(path):
 with Path(path).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
assert sha(p['sourceSelection'])==p['selectionSha256'];assert sha(r/'runner.py')==p['runtime']['wrapperSha256'];assert sha(case['prepared'])==case['preparedFloatSha256'];assert sha(p['model']['path'])==p['model']['sha256']
for source in p['runtime']['sourceSnapshots']:assert sha(source['path'])==source['sha256']
output=r/(id+'.json');log=r/(id+'.log');receipt=r/(id+'-attempt.json');assert not any(x.exists() for x in [output,log,receipt])
env=os.environ.copy();env.update({'HF_HUB_OFFLINE':'1','TRANSFORMERS_OFFLINE':'1','HF_HOME':str(r/'owned-cache/hf'),'MPLCONFIGDIR':str(r/'owned-cache/mpl'),'XDG_CACHE_HOME':str(r/'owned-cache/xdg')})
cmd=['/usr/bin/sandbox-exec','-p','(version 1)(allow default)(deny network*)',p['runtime']['python'],str(r/'runner.py'),p['model']['path'],case['prepared'],str(output)];start=time.monotonic();print('START',id,'original official NeMo',flush=True);child=subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,env=env,start_new_session=True);timed=False
try:data,_=child.communicate(timeout=p['plan']['deadlineSecondsPerCall'])
except subprocess.TimeoutExpired:
 timed=True;os.killpg(child.pid,signal.SIGKILL);data,_=child.communicate()
log.write_bytes(data);receipt.write_text(json.dumps({'command':cmd,'exitCode':child.returncode,'timedOut':timed,'wallSeconds':time.monotonic()-start,'protocolSha256':sha(r/'frozen-protocol.json'),'sourceSha256':case['preparedFloatSha256'],'networkDenied':True,'cacheScope':'Owned HF/MPL/XDG scratch only'},indent=2)+'\n');print(receipt.read_text(),flush=True);print(data.decode(errors='replace')[-5000:]);assert child.returncode==0 and not timed
