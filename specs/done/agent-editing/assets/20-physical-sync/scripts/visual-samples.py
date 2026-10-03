import sys
import subprocess,json,re,array,math
from pathlib import Path
root=Path(sys.argv[1]); out=Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
for name,path in [('camera',root/'camera/camera.raw.mov'),('screen',root/'screen/video.mov')]:
 log=open(out/(name+'.log'),'wb')
 vf='scale=160:90,format=gray,showinfo'
 proc=subprocess.Popen(['ffmpeg','-hide_banner','-nostdin','-copyts','-i',str(path),'-an','-vf',vf,'-fps_mode','passthrough','-f','rawvideo','-pix_fmt','gray','-'],stdout=subprocess.PIPE,stderr=log)
 frames=[]
 while True:
  b=proc.stdout.read(14400)
  if not b:break
  assert len(b)==14400
  # Full-frame mean plus 8x6 grid, to identify local flashes despite handheld framing.
  cells=[]
  for gy in range(6):
   for gx in range(8):
    cells.append(sum(sum(b[y*160+gx*20:y*160+(gx+1)*20]) for y in range(gy*15,(gy+1)*15))/300)
  frames.append(cells)
 assert proc.wait()==0
 log.close()
 pts=[float(x) for x in re.findall(r'\bn:\s*\d+\s+pts:\s*-?\d+\s+pts_time:([-\d.]+)',(out/(name+'.log')).read_text())]
 assert len(pts)==len(frames),(len(pts),len(frames))
 (out/(name+'-brightness.json')).write_text(json.dumps({'pts':pts,'grid8x6':frames}))
 print(name,len(pts),pts[0],pts[-1],flush=True)
