import json,subprocess,hashlib,pathlib,sys
p=pathlib.Path(sys.argv[1])
r=json.loads((p/'report.json').read_text()); movie=p/'shifted.mp4'
def run(args):return subprocess.check_output(args,timeout=180)
frames=json.loads(run(['ffprobe','-v','error','-select_streams','v:0','-show_frames','-show_entries','frame=best_effort_timestamp_time','-of','json',str(movie)]))['frames']
pixels=run(['ffmpeg','-v','error','-i',str(movie),'-map','0:v:0','-vf','scale=1:1:flags=area','-fps_mode','passthrough','-pix_fmt','gray','-f','rawvideo','pipe:1'])
assert pixels==(p/'pictures.gray').read_bytes()
run(['ffmpeg','-v','error','-nostdin','-i',str(movie),'-map','0:a:0','-ac','1','-ar','48000','-f','f32le',str(p/'shifted-audio.f32')])
def digest(path):
 h=hashlib.sha256()
 with open(path,'rb') as f:
  while b:=f.read(65536):h.update(b)
 return h.hexdigest()
assert digest(p/'shifted-audio.f32')==digest(p/'audio.f32')
centers=[];i=0;frame_us=r['timing']['maximumAllowedDriftUs']
while i<len(pixels):
 if pixels[i]>200:
  first=i
  while i+1<len(pixels) and pixels[i+1]>200:i+=1
  centers.append((float(frames[first]['best_effort_timestamp_time'])*1e6+float(frames[i]['best_effort_timestamp_time'])*1e6+frame_us)/2)
 i+=1
assert len(centers)==len(r['timing']['markers'])
deltas=[m['audioSample']*1e6/48000-c for m,c in zip(r['timing']['markers'],centers)]
assert all(abs(d)>frame_us for d in deltas)
result={'deliberateVideoDelayUs':100000,'sameDecodedVideoPixels':True,'sameDecodedAudioBytes':True,'markersRejected':len(deltas),'maximumAllowedDriftUs':frame_us,'minimumAbsoluteShiftedDriftUs':min(map(abs,deltas)),'maximumAbsoluteShiftedDriftUs':max(map(abs,deltas)),'mutantMovieSha256':digest(movie)}
(p/'negative-control.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
