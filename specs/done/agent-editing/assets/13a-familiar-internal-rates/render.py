import pathlib,hashlib,json,struct,subprocess,math
root=pathlib.Path('/Users/david/dev/screen-recorder'); out=pathlib.Path(__file__).parent
source=root/'specs/agent-editing/assets/13a-endpoint-verification/auditions/phrase-0-reference.wav'
worker=root/'helpers/stretch/.build/release/StretchParity'
def sha(b): return hashlib.sha256(b).hexdigest()
b=source.read_bytes(); frozen=worker.read_bytes()
assert sha(b)=='afb2a082d6712beef71dae54a89060710e62f9ee0db6e69c5e4eae029cf5bb0c'
assert sha(frozen)=='1cf7c24c73ba4b6ca3c05aa41fdccb07d62a5ea8ce65c66236bdf4b75743addc'
assert b[:4]==b'RIFF' and b[8:16]==b'WAVEfmt ' and b[36:40]==b'data'
assert struct.unpack_from('<HHIIHH',b,20)==(3,1,48000,192000,4,32)
pcm=b[44:]; assert len(pcm)==231360*4
start,end=22560,91680; selected=pcm[start*4:end*4]
assert sha(selected)=='9804fcac60fae4408ab31db526ac6f30f069ef52f873fc218b07cde2824745d3'
(out/'input.f32').write_bytes(pcm); (out/'selected.f32').write_bytes(selected)
poison=bytearray(pcm)
for i in range(len(pcm)//4):
 if i<start or i>=end: struct.pack_into('<f',poison,i*4,0.9 if i%2 else -0.9)
(out/'poison-input.f32').write_bytes(poison)
commands=[]
def render(name,inp,a,z,n):
 args=[str(worker),str(out/inp),str(out/(name+'.f32')),str(a),str(z),str(n),'48000']
 p=subprocess.run(args,capture_output=True,text=True,timeout=60)
 commands.append(dict(args=args,status=p.returncode,stdout=p.stdout,stderr=p.stderr))
 (out/'commands.json').write_text(json.dumps(commands,indent=2)+'\n')
 assert p.returncode==0,p.stderr
 result=(out/(name+'.f32')).read_bytes(); assert len(result)==n*4
 assert all(math.isfinite(v[0]) for v in struct.iter_unpack('<f',result))
 return result
report=dict(text='Okay, so this is the recorder workbench.',proposedRetimedText='so this is the',boundaryAuthority='Explicitly authored inherited-ASR gap midpoints; no independent protected whole-word labels',source=str(source),sourceSha256=sha(b),sourcePcmFrames=231360,worker=str(worker),workerSha256=sha(frozen),sourceFileRangeUs=[1520000,2960000],inputLocalSelectedFrames=[start,end],selectedPcmSha256=sha(selected),prefixFrames=start,suffixFrames=231360-end,policy='Frozen exact mono48k recipe, explicit selection only; no added processor context, gain, normalization, fade, trimming, model, build, or public adoption',listening='UNVERIFIED for these two rates',results=[],files=[])
(out/'original.wav').write_bytes(b)
for name,n,d in [('internal-slower-0.9x',9,10),('internal-faster-1.25x',5,4)]:
 wanted=(end-start)*d//n
 result=render(name,'input.f32',start,end,wanted)
 assert render(name+'-poison','poison-input.f32',start,end,wanted)==result
 assert render(name+'-selected-only','selected.f32',0,end-start,wanted)==result
 candidate=pcm[:start*4]+result+pcm[end*4:]
 assert candidate[:start*4]==pcm[:start*4] and candidate[(start+wanted)*4:]==pcm[end*4:]
 assert len(candidate)==(231360-(end-start)+wanted)*4
 header=bytearray(b[:44]);struct.pack_into('<I',header,4,len(candidate)+36);struct.pack_into('<I',header,40,len(candidate))
 (out/(name+'.wav')).write_bytes(header+candidate)
 report['results'].append(dict(path=name+'.wav',rate=dict(numerator=n,denominator=d),outputSelectedFrames=wanted,outputContextFrames=len(candidate)//4,outputJoinsFrames=[start,start+wanted],retimedPcmSha256=sha(result),checks=dict(exactCount=True,finite=True,excludedSourcePoisonIdentical=True,selectedOnlyIdentical=True,prefixBitIdentical=True,suffixBitIdentical=True)))
assert source.read_bytes()==b and worker.read_bytes()==frozen
for name in ['original.wav','internal-slower-0.9x.wav','internal-faster-1.25x.wav','render.py','commands.json']:
 v=(out/name).read_bytes();report['files'].append(dict(path=name,bytes=len(v),sha256=sha(v)))
(out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
