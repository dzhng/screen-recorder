import struct,zlib,json,pathlib
p=pathlib.Path('/tmp/screenrec-image-skill-M1kDJn/agent-output')
rows=[]
for name in ['diagram-full','diagram-small','card-full','card-small']:
 data=(p/(name+'.png')).read_bytes(); pos=8; compressed=b''
 while pos<len(data):
  n=struct.unpack('>I',data[pos:pos+4])[0]; typ=data[pos+4:pos+8]; body=data[pos+8:pos+8+n];pos+=12+n
  if typ==b'IHDR': w,h,depth,color,_,_,interlace=struct.unpack('>IIBBBBB',body)
  if typ==b'IDAT': compressed+=body
 assert depth==8 and color in (2,6) and interlace==0
 channels={2:3,6:4}[color]; stride=w*channels; raw=zlib.decompress(compressed); prev=[0]*stride; pixels=[]
 for y in range(h):
  filt=raw[y*(stride+1)];line=list(raw[y*(stride+1)+1:(y+1)*(stride+1)])
  for x in range(stride):
   a=line[x-channels] if x>=channels else 0;b=prev[x];c=prev[x-channels] if x>=channels else 0
   if filt==1: delta=a
   elif filt==2: delta=b
   elif filt==3: delta=(a+b)//2
   elif filt==4:
    q=a+b-c; distances=[abs(q-a),abs(q-b),abs(q-c)];delta=[a,b,c][distances.index(min(distances))]
   else: assert filt==0;delta=0
   line[x]=(line[x]+delta)%256
  pixels += [line[i:i+channels]+([255] if channels==3 else []) for i in range(0,stride,channels)]
  prev=line
 alpha=[v[3] for v in pixels]
 rows.append({'name':name,'size':[w,h],'pngColorType':color,'alphaRange':[min(alpha),max(alpha)],'alphaValues':sorted(set(alpha)),'samples':{k:pixels[y*w+x] for k,(x,y) in {'topLeft':(0,0),'topRight':(w-1,0),'bottomLeft':(0,h-1),'bottomRight':(w-1,h-1),'center':(w//2,h//2)}.items()}})
(p/'delivered-pixel-inspection.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(rows,indent=2))
