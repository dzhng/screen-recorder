from PIL import Image,ImageDraw,ImageChops
from pathlib import Path
import json,sys
src=Path(sys.argv[1]).resolve(); out=Path(sys.argv[2]).resolve(); out.mkdir(exist_ok=True,parents=True)
groups={}
for p in sorted(src.glob('*.png')):
 key='source' if p.name.startswith('source') else '-'.join(p.name.split('-')[:2])
 groups.setdefault(key,[]).append(p)
manifest=[]
for key,paths in groups.items():
 full=Image.new('RGB',(1280,290*((len(paths)+3)//4)),(235,235,235)); crop=Image.new('RGB',(1280,290*((len(paths)+3)//4)),(235,235,235))
 for i,p in enumerate(paths):
  im=Image.open(p).convert('RGBA'); w,h=im.size
  board=Image.new('RGBA',(w,h)); d=ImageDraw.Draw(board)
  for y in range(0,h,8):
   for x in range(0,w,8): d.rectangle((x,y,x+7,y+7),fill=(110,110,110,255) if (x//8+y//8)%2 else (155,155,155,255))
  displayed=Image.alpha_composite(board,im).convert('RGB')
  box=(im.getchannel('A') if im.getchannel('A').getextrema()!=(255,255) else im.convert('RGB').convert('L')).getbbox()
  box=(max(0,box[0]-6),max(0,box[1]-6),min(w,box[2]+6),min(h,box[3]+6)) if box else (0,0,w,h)
  enlarged=displayed.crop(box); enlarged=enlarged.resize((enlarged.width*4,enlarged.height*4),Image.Resampling.NEAREST)
  enlarged.save(out/(p.stem+'-crop.png'))
  # Contact crops scaled down only if >slot; original exact4x crop retained.
  enlarged.thumbnail((320,255))
  x=(i%4)*320;y=(i//4)*290
  full.paste(displayed,(x,y+30));crop.paste(enlarged,(x,y+30))
  for sheet in [full,crop]:ImageDraw.Draw(sheet).text((x+3,y+3),p.stem,fill='black')
  manifest.append({'file':str(p),'crop':str(out/(p.stem+'-crop.png')),'bbox':box})
 full.save(out/(key+'-full.png'));crop.save(out/(key+'-crops.png'))
(out/'manifest.json').write_text(json.dumps(manifest,indent=2))
print(len(manifest),'images',len(groups),'groups')
