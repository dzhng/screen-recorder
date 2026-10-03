from pathlib import Path
from PIL import Image, ImageDraw
from collections import Counter
import json,sys
src=Path(sys.argv[1]).resolve(); out=Path(sys.argv[2]).resolve();out.mkdir(exist_ok=True,parents=True)
groups={};manifest=[]
for p in sorted(src.glob('*.png')):
 name=p.stem
 if name.startswith('history-'):key='-'.join(name.split('-')[:2])
 elif name.startswith(('original-','replacement-reference-','replaced-')):key='acquisition'
 elif name.startswith(('padded-','padding-')):key='padding'
 elif name.startswith(('reset-','raw-')):key='reset'
 elif name.startswith('rollback-'):key='rollback'
 else:key='trim'
 groups.setdefault(key,[]).append(p)
for key,paths in groups.items():
 sheets=[Image.new('RGB',(1024,205*((len(paths)+3)//4)),(235,235,235)) for _ in range(2)]
 for i,p in enumerate(paths):
  name=p.stem
  im=Image.open(p).convert('RGB'); colors=Counter(im.get_flattened_data()); bg=max((c for c in colors if max(c)>0),key=colors.get)
  mask=Image.new('L',im.size);mask.putdata([255 if max(c)-min(c)>10 or sum(c)-sum(bg)>90 else 0 for c in im.get_flattened_data()]);box=mask.getbbox()
  box=(max(0,box[0]-6),max(0,box[1]-6),min(im.width,box[2]+6),min(im.height,box[3]+6)) if box else (0,0,im.width,im.height)
  crop=im.crop(box);crop=crop.resize((crop.width*4,crop.height*4),Image.Resampling.NEAREST);crop.save(out/(name+'-crop.png'))
  crop.thumbnail((256,175));x=i%4*256;y=i//4*205
  for sheet,pic in zip(sheets,[im,crop]):sheet.paste(pic,(x,y+30));ImageDraw.Draw(sheet).text((x+2,y+3),name,fill='black')
  manifest.append({'file':'../images/'+p.name,'crop':name+'-crop.png','bbox':box})
 for sheet,suffix in zip(sheets,['full','crops']):sheet.save(out/(key+'-'+suffix+'.png'))
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(len(manifest),'captures',len(groups),'groups')
