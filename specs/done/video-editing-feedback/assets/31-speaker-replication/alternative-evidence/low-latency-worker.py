"""Scratch, bounded single-selection streaming experiment; not public production code."""
import contextlib, hashlib, json, math, pathlib, resource, struct, sys, time

RECIPE = {"chunk_len":6,"chunk_right_context":7,"fifo_len":188,"spkcache_update_period":144,"spkcache_len":188}

def main(params):
    cases=params['cases']
    assert 1 <= len(cases) <= 12
    inputs=[]
    for case in cases:
        assert 1280 <= case['frames'] <= 9600000
        data=pathlib.Path(case['pcm']).read_bytes()
        assert len(data)==case['frames']*4 and hashlib.sha256(data).hexdigest()==case['pcmSha256']
        assert all(math.isfinite(x[0]) for x in struct.iter_unpack('<f',data))
        assert not pathlib.Path(case['output']).exists()
        inputs.append(data)
    assert hashlib.sha256(pathlib.Path(params['model']).read_bytes()).hexdigest()=='8abd32832159c6ac1148c926b7276f35ba34582c444e559dce1f1253fea42ef8'
    started=time.perf_counter()
    import numpy as np
    import torch
    from nemo.collections.asr.models import SortformerEncLabelModel
    torch.set_num_threads(2);torch.set_num_interop_threads(2)
    model=SortformerEncLabelModel.restore_from(params['model'],map_location=torch.device('cpu'),strict=True)
    model.eval()
    for k,v in RECIPE.items():setattr(model.sortformer_modules,k,v)
    model.sortformer_modules._check_streaming_parameters()
    loaded=time.perf_counter(); results=[]
    for case,data in zip(cases,inputs):
        samples=np.frombuffer(data,dtype='<f4').copy();t=time.perf_counter()
        with torch.inference_mode():
            lines,tensors=model.diarize(audio=[samples],sample_rate=16000,batch_size=1,include_tensor_outputs=True,num_workers=0,verbose=False)
        elapsed=time.perf_counter()-t
        assert len(lines)==len(tensors)==1
        raw=tensors[0].detach().cpu().numpy()
        import base64
        native={'nativeSegmentLines':lines,'shape':list(raw.shape),'dtype':raw.dtype.str,'bytesBase64':base64.b64encode(raw.tobytes()).decode('ascii')}
        pathlib.Path(case['output']+'.native-unverified.json').write_text(json.dumps(native))
        assert raw.shape==(1,math.ceil(case['frames']/1280),4) and raw.dtype.str=='<f4'
        scores=raw.reshape(-1,4).tolist();assert all(all(math.isfinite(v) and 0<=v<=1 for v in row) for row in scores)
        turns=[]
        for line in lines[0]:
            start,end,slot=line.split();start=float(start);end=float(end)
            assert 0 <= start < end <= len(samples)/16000 and slot in ['speaker_0','speaker_1','speaker_2','speaker_3']
            turns.append({'speaker':slot,'start':start,'end':end})
        report={'id':case['id'],'segments':turns,'nativeSegmentLines':lines[0],'nativeProbabilities':scores,'probabilityShape':list(raw.shape),'sourceFrames':len(samples),'audioSeconds':len(samples)/16000,'sampleRate':16000,'frameSeconds':.08,'config':RECIPE,'pcmSha256':case['pcmSha256'],'inferenceSeconds':elapsed,'peakProcessRSSBytes':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss}
        with open(case['output'],'x') as out:json.dump(report,out,allow_nan=False)
        results.append({k:report[k] for k in ['id','audioSeconds','inferenceSeconds','peakProcessRSSBytes','pcmSha256']})
    return {'cases':results,'coldLoadSeconds':loaded-started,'recipe':RECIPE,'stateScope':'one fresh state per selected input; persistent across all native internal chunks'}

try:
    request=json.loads(sys.stdin.readline());assert request['operation']=='speaker.continuityLab'
    with contextlib.redirect_stdout(sys.stderr): result=main(request['params'])
    print(json.dumps({'ok':True,'data':result}),flush=True)
except Exception as exc:
    print(json.dumps({'ok':False,'error':{'code':'RESEARCH_FAILED','message':str(exc),'details':{},'retryable':False}}),flush=True)
