import sys,json,time,hashlib,resource,base64,os
request=json.loads(sys.stdin.read());params=request['params']
start=time.perf_counter()
import torch,torchaudio
assert torch.__version__.split('+')[0]=='2.8.0'
assert torchaudio.__version__.split('+')[0]=='2.8.0'
torch.set_num_threads(2);torch.set_num_interop_threads(2)
reports=[]
try:
 for case in params['cases']:
  raw=json.load(open(case['emissions']));scores=torch.tensor(raw['logProbs'],dtype=torch.float32).unsqueeze(0);blank=raw['blankId'];vocab=raw['vocabulary'];greedy=[];previous=None
  for token in scores[0].argmax(dim=1).tolist():
   if token!=blank and token!=previous:greedy.append(token)
   previous=token
  candidates=[]
  for tokenization in raw['tokenizations']:
   ids=tokenization['ids'];item={'text':tokenization['text'],'ids':ids,'status':'forced_path_observation','assignmentConfidence':None}
   if not ids or blank in ids or max(ids)>=scores.shape[2]:item.update(status='refused',reason='Empty/blank/out-of-vocabulary supplied tokenization');candidates.append(item);continue
   try:
    target=torch.tensor([ids],dtype=torch.int64);t=time.perf_counter();path,frame_scores=torchaudio.functional.forced_align(scores,target,blank=blank)
    spans=torchaudio.functional.merge_tokens(path[0],frame_scores[0].exp(),blank=blank)
    records=[{'token':x.token,'startFrame':x.start,'endFrame':x.end,'startSeconds':x.start*raw['frameDuration'],'endSeconds':x.end*raw['frameDuration'],'nativeMeanTokenProbability':x.score} for x in spans]
    item.update(path=path[0].tolist(),frameLogScores=frame_scores[0].tolist(),spans=records,nativePathMeanLogScore=float(frame_scores.mean()),nativeNonblankMeanLogScore=float(frame_scores[path!=blank].mean()),alignmentSeconds=time.perf_counter()-t)
    if not torch.isfinite(frame_scores).all():item.update(status='refused',reason='Nonfinite forced path scores')
   except Exception as e:item.update(status='refused',reason=str(e))
   candidates.append(item)
  report={'id':case['id'],'emissionsSha256':hashlib.sha256(open(case['emissions'],'rb').read()).hexdigest(),'pcmSha256':raw['pcmSha256'],'sourceFrames':raw['sourceFrames'],'audioSeconds':raw['audioSeconds'],'emissionShape':raw['shape'],'frameDuration':raw['frameDuration'],'blankId':blank,'greedyTokenIds':greedy,'greedyText':''.join(vocab.get(str(t),'[unknown]') for t in greedy).replace('▁',' ').strip(),'candidates':candidates,'semantics':'Forced alignment always conditions on supplied text; successful path is not lexical truth. Native likelihoods uncalibrated. No acceptance confidence or mismatch threshold invented.','torch':torch.__version__,'torchaudio':torchaudio.__version__}
  # Path arrays and source emissions remain complete; refusal scores use JSON null rather than invented finite scores.
  for item in candidates:
   if item['status']=='refused':
    for key in ['nativePathMeanLogScore','nativeNonblankMeanLogScore','frameLogScores']:
     if key in item:item[key]=None
  with open(case['output'],'x') as out:json.dump(report,out,allow_nan=False,indent=2)
  reports.append({'id':case['id'],'greedyText':report['greedyText'],'statuses':[x['status'] for x in candidates]})
 print(json.dumps({'ok':True,'data':{'cases':reports,'wallSeconds':time.perf_counter()-start,'peakProcessRSSBytes':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss}}))
except Exception as e:print(json.dumps({'ok':False,'error':{'code':'ALIGNMENT_REFERENCE_FAILURE','message':str(e),'retryable':False,'details':{}}}))
