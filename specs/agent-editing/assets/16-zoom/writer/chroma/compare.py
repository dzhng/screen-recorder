from pathlib import Path
import subprocess,json,hashlib,sys
inputs=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir();source=out/'input.rgba';original=b''.join((inputs/f'writer-{i}.rgba').read_bytes() for i in range(8));source.write_bytes(original)
report={'hypothesis':'Color subsampling creates large edge deltas even without compression','inputSha256':hashlib.sha256(original).hexdigest(),'size':[40,64],'frames':8,'encoder':'none','trials':[],'scope':'Controlled RGB/YUV code-value roundtrip, not a native display or production profile'}
base=['/opt/homebrew/bin/ffmpeg','-v','error']
for fmt in ['yuv444p','yuv420p']:
 yuv=out/(fmt+'.raw');rgba=out/(fmt+'.rgba')
 forward=base+['-f','rawvideo','-pixel_format','rgba','-video_size','40x64','-framerate','8','-i',str(source),'-vf','scale=in_range=pc:out_range=tv:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int','-pix_fmt',fmt,'-f','rawvideo',str(yuv)]
 reverse=base+['-f','rawvideo','-pixel_format',fmt,'-video_size','40x64','-framerate','8','-i',str(yuv),'-vf','scale=in_range=tv:out_range=pc:in_color_matrix=bt709:flags=accurate_rnd+full_chroma_int','-pix_fmt','rgba','-f','rawvideo',str(rgba)]
 subprocess.run(forward,check=True);subprocess.run(reverse,check=True);actual=rgba.read_bytes();assert len(actual)==len(original)
 samples=[]
 for i in range(8):
  a=actual[i*10240:(i+1)*10240];b=original[i*10240:(i+1)*10240];d=[abs(x-y) for j,(x,y) in enumerate(zip(a,b)) if j%4!=3]
  samples.append({'index':i,'max':max(d),'mean':sum(d)/len(d),'fractionOver4':sum(v>4 for v in d)/len(d)})
 report['trials'].append({'format':fmt,'commands':[forward,reverse],'outputSha256':hashlib.sha256(actual).hexdigest(),'samples':samples})
(out/'report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
