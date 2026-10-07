"""Scratch, bounded single-selection streaming experiment; not public production code."""
import contextlib, hashlib, json, math, pathlib, resource, struct, sys, time

sys.path[0:0]=['/tmp/yap-editing-speaker-replication/nemo-speech-source/selected','/tmp/yap-editing-speaker-replication/lhotse-source/sparse','/tmp/yap-editing-speaker-replication/nemo3-wheel/unpacked']

RECIPE = {"chunk_len":340,"chunk_right_context":40,"fifo_len":40,"spkcache_update_period":300,"spkcache_len":376}

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
    assert hashlib.sha256(pathlib.Path(params['model']).read_bytes()).hexdigest()=='dcaaff77f4469fe35ce1eb4560349832058175c57613d509058a7624739e2ae9'
    started=time.perf_counter()
    import numpy as np
    import torch
    from nemo.collections.asr.models import SortformerEncLabelModel
    import inspect
    assert pathlib.Path(inspect.getfile(SortformerEncLabelModel)).resolve().is_relative_to(pathlib.Path('/tmp/yap-editing-speaker-replication/nemo-speech-source/selected').resolve())
    torch.set_num_threads(2);torch.set_num_interop_threads(2)
    model=SortformerEncLabelModel.restore_from(params['model'],map_location=torch.device('cpu'),strict=True)
    model.eval()
    assert model.async_streaming is False and model.async_pad_to_max is False
    assert model._cfg.max_num_of_spks==8 and model.output_subsampling_factor==8 and model.high_resolution is False
    assert model.sortformer_modules.async_desync_updates is False
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
        assert raw.shape==(1,math.ceil(case['frames']/1280),8) and raw.dtype.str=='<f4'
        scores=raw.reshape(-1,8).tolist();assert all(all(math.isfinite(v) and 0<=v<=1 for v in row) for row in scores)
        turns=[]
        for line in lines[0]:
            start,end,slot=line.split();start=float(start);end=float(end)
            assert 0 <= start < end <= len(samples)/16000 and slot in ['speaker_'+str(i) for i in range(8)]
            turns.append({'speaker':slot,'start':start,'end':end})
        report={'id':case['id'],'segments':turns,'nativeSegmentLines':lines[0],'nativeProbabilities':scores,'probabilityShape':list(raw.shape),'sourceFrames':len(samples),'audioSeconds':len(samples)/16000,'sampleRate':16000,'frameSeconds':.08,'frameSamples':1280,'config':RECIPE,'modelConfig':str(model._cfg),'asyncStreaming':model.async_streaming,'pcmSha256':case['pcmSha256'],'inferenceSeconds':elapsed,'peakProcessRSSBytes':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss}
        with open(case['output'],'x') as out:json.dump(report,out,allow_nan=False)
        results.append({k:report[k] for k in ['id','audioSeconds','inferenceSeconds','peakProcessRSSBytes','pcmSha256']})
    return {'cases':results,'coldLoadSeconds':loaded-started,'recipe':RECIPE,'stateScope':'one fresh state per selected input; persistent across all native internal chunks'}

try:
    request=json.loads(sys.stdin.readline());assert request['operation']=='speaker.continuityLab'
    with contextlib.redirect_stdout(sys.stderr): result=main(request['params'])
    print(json.dumps({'ok':True,'data':result}),flush=True)
except Exception as exc:
    print(json.dumps({'ok':False,'error':{'code':'RESEARCH_FAILED','message':str(exc),'details':{},'retryable':False}}),flush=True)
