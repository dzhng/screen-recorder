import sys,json,hashlib,time,resource,base64,array,math
req=json.loads(sys.stdin.read());p=req['params'];start=time.perf_counter()
protocol_out=sys.stdout;sys.stdout=sys.stderr
try:
 for c in p['cases']:
  data=open(c['pcm'],'rb').read()
  assert len(data)==c['frames']*4 and hashlib.sha256(data).hexdigest()==c['pcmSha256']
  a=array.array('f');a.frombytes(data);assert all(math.isfinite(x) for x in a)
 import torch,numpy as np,nemo
 from nemo.collections.asr.models import EncDecHybridRNNTCTCBPEModel
 assert torch.__version__.split('+')[0]=='2.8.0';assert nemo.__version__=='2.7.3'
 torch.set_num_threads(2);torch.set_num_interop_threads(2)
 load=time.perf_counter();model=EncDecHybridRNNTCTCBPEModel.restore_from(p['checkpoint'],map_location=torch.device('cpu'),strict=True);model.eval();model.preprocessor.featurizer.dither=0.;model.preprocessor.featurizer.pad_to=0
 load_seconds=time.perf_counter()-load
 vocab={str(i):token for i,token in enumerate(model.ctc_decoder.vocabulary)};blank=model.ctc_decoder.num_classes_with_blank-1
 frame_seconds=float(model.cfg.preprocessor.window_stride)*int(model.cfg.encoder.subsampling_factor)
 assert blank==1024 and len(vocab)==1024 and frame_seconds==.08
 results=[]
 for c in p['cases']:
  audio=np.fromfile(c['pcm'],dtype='<f4');signal=torch.from_numpy(audio.copy()).reshape(1,-1);length=torch.tensor([len(audio)],dtype=torch.int64);now=time.perf_counter()
  with torch.inference_mode():
   encoded,encoded_len=model(input_signal=signal,input_signal_length=length);log_probs=model.ctc_decoder(encoder_output=encoded);valid_frames=int(encoded_len[0]);matrix=log_probs[0,:valid_frames].cpu().float().contiguous()
  seconds=time.perf_counter()-now;native_bytes=matrix.numpy().astype('<f4').tobytes()
  capture={'id':c['id'],'shape':list(matrix.shape),'bytesBase64':base64.b64encode(native_bytes).decode(),'dtype':'<f4','emissionLength':valid_frames,'untrimmedShape':list(log_probs.shape)}
  with open(c['output']+'.native.json','x') as f:json.dump(capture,f,allow_nan=False)
  assert torch.isfinite(matrix).all()
  out={'id':c['id'],'pcmSha256':c['pcmSha256'],'sourceFrames':len(audio),'audioSeconds':len(audio)/16000,'sampleRate':16000,'blankId':blank,'vocabulary':vocab,'logProbs':matrix.tolist(),'nativeLogProbBytesBase64':base64.b64encode(native_bytes).decode(),'shape':list(matrix.shape),'frameDuration':frame_seconds,'totalFrames':valid_frames,'emittedClockEndSeconds':valid_frames*frame_seconds,'tokenizations':[{'text':text,'ids':model.tokenizer.text_to_ids(text)} for text in c['texts']],'nativeEmissionScope':'Original hybrid model ctc_decoder log-probs, encoder_len support, configured window_stride×subsampling clock; no TDT decoding or transcript-derived emissions','inferenceSeconds':seconds,'modelLoadSeconds':load_seconds,'peakProcessRSSBytes':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,'modelConfig':str(model.cfg),'modelSha256':p['modelSha256'],'torch':torch.__version__,'nemo':nemo.__version__}
  with open(c['output'],'x') as f:json.dump(out,f,allow_nan=False)
  results.append({'id':c['id'],'shape':list(matrix.shape),'seconds':seconds,'RSSBytes':out['peakProcessRSSBytes']})
 print(json.dumps({'ok':True,'data':{'strictRestore':True,'loadSeconds':load_seconds,'frameSeconds':frame_seconds,'cases':results,'wallSeconds':time.perf_counter()-start}}),file=protocol_out)
except Exception as e:print(json.dumps({'ok':False,'error':{'code':'NEMO_CTC_REFERENCE_FAILURE','message':str(e),'retryable':False,'details':{}}}),file=protocol_out)
