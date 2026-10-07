"""Frozen original Community-1 research call; observer hooks never alter tensors."""
import sys,pathlib,json,hashlib,math,contextlib,time,resource,base64
ROOT=pathlib.Path('/tmp/yap-speaker-hysteresis-20261006/community1-admission')
sys.path.insert(0,str(ROOT/'dependency-layer'))
def main(params):
    case=params['case']; data=pathlib.Path(case['pcm']).read_bytes()
    assert len(data)==case['frames']*4 and hashlib.sha256(data).hexdigest()==case['pcmSha256']
    preparation=json.loads((ROOT/'acquisition-protocol.json').read_text())
    model=pathlib.Path(params['model'])
    for f in preparation['manifest']['files']:
        b=(model/f['path']).read_bytes(); assert len(b)==f['bytes'] and hashlib.sha256(b).hexdigest()==f['sha256']
    began=time.perf_counter()
    import numpy as np,torch,inspect,pyannote.audio
    from pyannote.audio import Pipeline
    from pyannote.audio.pipelines import SpeakerDiarization
    assert pyannote.audio.__version__=='4.0.0' and torch.__version__.split('+')[0]=='2.8.0'
    assert pathlib.Path(inspect.getfile(SpeakerDiarization)).resolve().is_relative_to((ROOT/'dependency-layer').resolve())
    torch.set_num_threads(2);torch.set_num_interop_threads(2)
    pipeline=Pipeline.from_pretrained(model,token=False,cache_dir=ROOT/'cache')
    assert isinstance(pipeline,SpeakerDiarization)
    pipeline.to(torch.device('cpu'))
    loaded=time.perf_counter()
    samples=np.frombuffer(data,dtype='<f4').copy(); assert np.isfinite(samples).all()
    captured=[];forwards=[]
    def array(value):
        if isinstance(value,torch.Tensor): value=value.detach().cpu().numpy()
        value=np.asarray(value)
        return {'shape':list(value.shape),'dtype':value.dtype.str,'bytesBase64':base64.b64encode(value.tobytes()).decode('ascii')}
    def model_forward(module,inputs,output):
        forwards.append({'inputShapes':[list(x.shape) for x in inputs if isinstance(x,torch.Tensor)],'output':array(output)})
    def hook(step,artifact,**kwargs):
        if artifact is None:return
        if hasattr(artifact,'sliding_window'):
            sw=artifact.sliding_window
            captured.append({'step':step,'array':array(artifact.data),'slidingWindow':{'start':sw.start,'step':sw.step,'duration':sw.duration}})
        elif isinstance(artifact,np.ndarray):captured.append({'step':step,'array':array(artifact)})
        else:raise ValueError('Unrecognized native hook operand '+step)
    observer=pipeline._segmentation.model.register_forward_hook(model_forward)
    began_inference=time.perf_counter()
    with torch.inference_mode(): output=pipeline({'waveform':torch.from_numpy(samples).unsqueeze(0),'sample_rate':16000,'uri':case['id']},hook=hook)
    inference=time.perf_counter()-began_inference; observer.remove()
    turns=[{'speaker':speaker,'start':turn.start,'end':turn.end} for turn,_,speaker in output.speaker_diarization.itertracks(yield_label=True)]
    exclusive=[{'speaker':speaker,'start':turn.start,'end':turn.end} for turn,_,speaker in output.exclusive_speaker_diarization.itertracks(yield_label=True)]
    rf=pipeline._segmentation.model.receptive_field
    native={'id':case['id'],'sourceFrames':len(samples),'sampleRate':16000,'audioSeconds':len(samples)/16000,'pcmSha256':case['pcmSha256'],'segments':turns,'exclusiveSegments':exclusive,'nativeForwardScores':forwards,'nativeHookOperands':captured,'speakerEmbeddings':array(output.speaker_embeddings),'modelReceptiveField':{'start':rf.start,'step':rf.step,'duration':rf.duration},'modelSpecifications':str(pipeline._segmentation.model.specifications),'nativeConfig':pipeline.parameters(instantiated=True),'coldLoadSeconds':loaded-began,'inferenceSeconds':inference,'peakProcessRSSBytes':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss}
    with open(case['output']+'.native-unverified.json','x') as f:json.dump(native,f,allow_nan=False)
    bad=[x for x in turns if not (math.isfinite(x['start']) and math.isfinite(x['end']) and 0<=x['start']<x['end']<=len(samples)/16000)]
    assert not bad, 'Native annotation exceeds physical support: '+json.dumps(bad)
    assert forwards and any(x['step']=='segmentation' for x in captured) and any(x['step']=='embeddings' for x in captured)
    with open(case['output'],'x') as f:json.dump(native,f,allow_nan=False)
    return {k:native[k] for k in ['id','sourceFrames','pcmSha256','coldLoadSeconds','inferenceSeconds','peakProcessRSSBytes']}
try:
    request=json.loads(sys.stdin.readline()); assert request['operation']=='speaker.community1Lab'
    with contextlib.redirect_stdout(sys.stderr):result=main(request['params'])
    print(json.dumps({'ok':True,'data':result}),flush=True)
except Exception as e:
    print(json.dumps({'ok':False,'error':{'code':'RESEARCH_FAILED','message':str(e),'details':{},'retryable':False}}),flush=True)
