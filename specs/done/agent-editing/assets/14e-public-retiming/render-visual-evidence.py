from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib,json,math,os,shutil,subprocess,sys
out=Path(sys.argv[1]).resolve();root=Path.cwd();report=json.loads((out/'report.json').read_text());target=out/'visual';target.mkdir(exist_ok=True)
reference=target/'reference';candidate=target/'candidate';reference.mkdir(exist_ok=True);candidate.mkdir(exist_ok=True)
rows={v['name']:v for v in report['frames']}
pairs=['before','start','event-one','event-two','tail-event','end']
for name in pairs:
 for folder,key in [(reference,'source-reference-'+name),(candidate,'linked-'+name)]:shutil.copyfile(rows[key]['path'],folder/(name+'.png'))
crops={name:{'label':'Counter and event panel','x':20,'y':24,'width':595,'height':190} for name in pairs};(target/'crops.json').write_text(json.dumps(crops,indent=2)+'\n')
env=os.environ|{'REPO_ROOT':'/Users/david/.cache/codex-runtimes/codex-primary-runtime/dependencies/node','REFERENCE_DIR':str(reference),'CANDIDATE_DIR':str(candidate),'OUT_DIR':str(target/'comparison'),'CROPS_JSON':str(target/'crops.json'),'REPORT_ORDER':','.join(pairs)}
command=['node',str(root/'.agents/skills/compare-screenshots/scripts/visual-parity-diff.mjs')]
r=subprocess.run(command,env=env,capture_output=True,text=True);(target/'comparison.log').write_text(r.stdout+r.stderr);assert r.returncode==0,r.stderr
font=ImageFont.load_default(size=18)
neutral=target/'neutral';neutral.mkdir(exist_ok=True)
images=[]
for i,row in enumerate(report['frames'],1):
 original=Image.open(row['path']).convert('RGB');name=f'{i:02d}'
 original.save(neutral/(name+'-full.png'))
 areas=[('counter',(20,24,515,86),2),('events',(520,124,616,202),3),('markers',(16,224,610,276),2),('bits',(20,302,612,360),2)]
 tiles=[]
 for label,box,scale in areas:
  crop=original.crop(box);crop=crop.resize((crop.width*scale,crop.height*scale),Image.Resampling.NEAREST)
  tile=Image.new('RGB',(max(1200,crop.width),crop.height+28),'white');tile.paste(crop,(0,28));ImageDraw.Draw(tile).text((6,4),name+' '+label,fill='black',font=font);tiles.append(tile)
 sheet=Image.new('RGB',(max(t.width for t in tiles),sum(t.height for t in tiles)),'white');at=0
 for tile in tiles:sheet.paste(tile,(0,at));at+=tile.height
 sheet.save(neutral/(name+'-crops.png'))
 images.append({'panel':name,'name':row['name'],'full':str(neutral/(name+'-full.png')),'crops':str(neutral/(name+'-crops.png')),'sourceSha256':hashlib.sha256(Path(row['path']).read_bytes()).hexdigest()})
for start in range(0,len(images),6):
 selected=images[start:start+6];sheet=Image.new('RGB',(1280,math.ceil(len(selected)/2)*390),'white');draw=ImageDraw.Draw(sheet)
 for i,row in enumerate(selected):
  x=(i%2)*640;y=(i//2)*390;sheet.paste(Image.open(row['full']),(x,y+28));draw.text((x+8,y+4),'Panel '+row['panel'],fill='black',font=font)
 sheet.save(neutral/f'full-set-{start//6+1}.png')
(target/'panels.json').write_text(json.dumps(images,indent=2)+'\n')
(target/'scope.json').write_text(json.dumps({'target':'Paired source and retimed captures must show the same physical counter/event landmark. Only authored attachment markers may differ; labels and counter bits must remain readable.','notJudged':['audio perceptual quality','unrelated color/marketing design'],'comparisonCommand':command,'comparisonEnvironment':{k:v for k,v in env.items() if k in ['REPO_ROOT','REFERENCE_DIR','CANDIDATE_DIR','OUT_DIR','CROPS_JSON','REPORT_ORDER']},'completeCaptureSet':images,'freshCritique':'pending'},indent=2)+'\n')
print(target)
