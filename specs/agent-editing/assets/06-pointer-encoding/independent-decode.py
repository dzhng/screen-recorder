import subprocess,json,pathlib,hashlib,sys
root=pathlib.Path(sys.argv[1]); rows={}
for cohort in ['full','range']:
 p=root/cohort/'movie.mp4'
 raw=subprocess.run(['ffmpeg','-v','error','-i',str(p),'-fps_mode','passthrough','-f','rawvideo','-pix_fmt','rgba','-'],stdout=subprocess.PIPE,check=True).stdout
 size=256*160*4
 assert len(raw)==size*({'full':20,'range':3}[cohort])
 rows[cohort]=[raw[i:i+size] for i in range(0,len(raw),size)]
result=[]
for j,index in enumerate([10,11,12]):
 a,b=rows['full'][index],rows['range'][j]
 def mask(raw):
  pts=[(i//4%256,i//4//256) for i in range(0,len(raw),4) if raw[i]>raw[i+1]+20 and raw[i+2]>raw[i+1]+10]
  return [sum(p[d] for p in pts)/len(pts) for d in [0,1]],len(pts)
 ca,na=mask(a);cb,nb=mask(b)
 result.append({'frame':index,'fullCount':na,'rangeCount':nb,'centroidDelta':[cb[d]-ca[d] for d in [0,1]],'changedChannels':sum(x!=y for x,y in zip(a,b)),'fullSHA256':hashlib.sha256(a).hexdigest(),'rangeSHA256':hashlib.sha256(b).hexdigest()})
(root/'independent-decode.json').write_text(json.dumps({'decoder':'ffmpeg rgba; corroboration only, Apple decoder remains original evaluator','frames':result},indent=2)+'\n')
print(json.dumps(result))
