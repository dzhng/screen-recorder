from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,subprocess,shutil,os,math
root=Path.cwd();out=Path('/tmp/screenrec-retimed-zoom-16-complete');report=json.loads((out/'report.json').read_text());dest=out/'visual';dest.mkdir(exist_ok=True)
font=ImageFont.load_default(size=16);manifest=[]
neutral=dest/'neutral';neutral.mkdir(exist_ok=True)
for i,row in enumerate(report['pictures'],1):
 name=f'{i:02d}';im=Image.open(row['path']).convert('RGB');im.save(neutral/f'{name}-full.png');s=row['scale'];left=(1-s)*320;top=(1-s)*180
 boxes=[('counter',(left+24*s,top+24*s,left+515*s,top+92*s)),('red-bar',(left-3,top-3,left+21*s+3,top+103*s+3)),('bits',(left+20*s,top+300*s,left+615*s,top+360*s))]
 tiles=[]
 for label,box in boxes:
  box=tuple(int(x) for x in box);crop=im.crop(box);crop=crop.resize((crop.width*3,crop.height*3),Image.Resampling.NEAREST);tile=Image.new('RGB',(max(1250,crop.width),crop.height+26),'white');tile.paste(crop,(0,26));ImageDraw.Draw(tile).text((5,3),name+' '+label,fill='black',font=font);tiles.append(tile)
 sheet=Image.new('RGB',(max(t.width for t in tiles),sum(t.height for t in tiles)),'white');y=0
 for tile in tiles:sheet.paste(tile,(0,y));y+=tile.height
 sheet.save(neutral/f'{name}-crops.png');manifest.append({'panel':name,'name':row['name'],'full':str(neutral/f'{name}-full.png'),'crops':str(neutral/f'{name}-crops.png')})
for start in range(0,len(manifest),6):
 sheet=Image.new('RGB',(1280,390*math.ceil(len(manifest[start:start+6])/2)),'white');d=ImageDraw.Draw(sheet)
 for j,row in enumerate(manifest[start:start+6]):x=j%2*640;y=j//2*390;sheet.paste(Image.open(row['full']),(x,y+28));d.text((x+6,y+5),'Panel '+row['panel'],fill='black',font=font)
 sheet.save(neutral/f'full-sheet-{start//6+1}.png')
for index,movie in enumerate(report['movies'],1):
 frames=dest/f'movie-{index}';frames.mkdir(exist_ok=True)
 subprocess.run(['ffmpeg','-v','error','-nostdin','-i',movie['path'],'-map','0:v:0','-vsync','0',str(frames/'%03d.png')],check=True)
 files=sorted(frames.glob('*.png'));assert len(files)==len(movie['frames'])
 for start in range(0,len(files),20):
  selected=files[start:start+20];sheet=Image.new('RGB',(1280,204*math.ceil(len(selected)/4)),'white');d=ImageDraw.Draw(sheet)
  for j,path in enumerate(selected):x=j%4*320;y=j//4*204;im=Image.open(path).convert('RGB').resize((320,180));sheet.paste(im,(x,y+24));d.text((x+4,y+3),f'Movie {index} frame {start+j}',fill='black',font=font)
  sheet.save(neutral/f'movie-{index}-sheet-{start//20+1:02d}.png')
reference=dest/'reference';candidate=dest/'candidate';reference.mkdir(exist_ok=True);candidate.mkdir(exist_ok=True)
for i in [15,30,52,70,89]:
 for folder,name in [(reference,'static-content-'+str(i)),(candidate,'content-'+str(i))]:shutil.copyfile(next(r['path'] for r in report['pictures'] if r['name']==name),folder/(str(i)+'.png'))
env=os.environ|{'REPO_ROOT':'/Users/david/.cache/codex-runtimes/codex-primary-runtime/dependencies/node','REFERENCE_DIR':str(reference),'CANDIDATE_DIR':str(candidate),'OUT_DIR':str(dest/'comparison'),'REPORT_ORDER':'15,30,52,70,89'}
r=subprocess.run(['node',str(root/'.agents/skills/compare-screenshots/scripts/visual-parity-diff.mjs')],env=env,text=True,capture_output=True);(dest/'comparison.log').write_text(r.stdout+r.stderr);assert r.returncode==0
(dest/'manifest.json').write_text(json.dumps({'pictures':manifest,'movies':[{'number':i+1,'name':m['name'],'frames':len(m['frames'])} for i,m in enumerate(report['movies'])]},indent=2)+'\n')
print(dest)
