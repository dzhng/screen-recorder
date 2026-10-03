import pathlib,struct,json,hashlib
out=pathlib.Path(__file__).parent
b=(out/'original.wav').read_bytes();assert hashlib.sha256(b).hexdigest()=='afb2a082d6712beef71dae54a89060710e62f9ee0db6e69c5e4eae029cf5bb0c'
a=b[44:];silence=bytes(24000*4)
pcm=a[:22560*4]+silence+a[22560*4:91680*4]+silence+a[91680*4:]
assert len(pcm)==279360*4
segments=[{'source':[0,22560],'output':[0,22560],'proposedText':'Okay'},{'source':[22560,91680],'output':[46560,115680],'proposedText':'so this is the'},{'source':[91680,231360],'output':[139680,279360],'proposedText':'recorder workbench'}]
for s in segments: assert a[s['source'][0]*4:s['source'][1]*4]==pcm[s['output'][0]*4:s['output'][1]*4]
assert pcm[22560*4:46560*4]==silence and pcm[115680*4:139680*4]==silence
h=bytearray(b[:44]);struct.pack_into('<I',h,4,len(pcm)+36);struct.pack_into('<I',h,40,len(pcm));result=h+pcm
(out/'boundary-annotation-reference.wav').write_bytes(result)
report={'purpose':'Annotation reference only, NOT a naturalness candidate','boundaryAuthority':'Authored inherited-ASR gap midpoints; complete-word containment UNVERIFIED','sourceSha256':hashlib.sha256(b).hexdigest(),'outputFrames':279360,'outputSha256':hashlib.sha256(result).hexdigest(),'silenceRangesFrames':[[22560,46560],[115680,139680]],'segments':segments,'checks':{'allOriginalSamplesUnchanged':True,'onlyTwoHalfSecondDigitalSilencesAdded':True},'policy':'No fades, gain, stretch or hidden context; every original PCM sample retained in order','scriptSha256':hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest()}
(out/'annotation-reference.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
