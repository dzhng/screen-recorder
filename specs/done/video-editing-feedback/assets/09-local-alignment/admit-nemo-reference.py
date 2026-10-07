import json,hashlib
from pathlib import Path
b=Path('/tmp/yap-editing-alignment-replication');d=b/'nemo-ctc110-admission';d.mkdir()
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
p=b/'nemo-ctc110/protocol-r2.json';recipe={'status':'frozen-before-admission','sourceProtocolSha256':digest(p),'arithmeticWorkerSha256':digest(b/'align-ctc.py'),'admissionWorkerSha256':digest(Path(__file__)),'nativeClock':{'frameSamples':1280,'sampleRate':16000,'provenance':'Original configured window_stride .01 × encoder subsampling8; preserve native ceil encoded_len and no clock fit'},'supportPolicy':'Refuse any conditional token span whose half-open frame-cell support crosses physical PCM sample support. Preserve all original path operands. No padding clamp. Other paths are conditional evidence with lexical assignment unknown; never successful recognition.','lexicalPolicy':'Every supplied-text forced path has assignmentConfidence null. Greedy is a diagnostic comparison, not independently correct truth. Wrong/extra/omitted text never admitted as verified words. Native likelihood uncalibrated; no threshold.','partialPolicy':'Physical truncation fixture known; lexical partial identity unknown. No guessed generator prefix is truth.'}
(d/'protocol.json').write_text(json.dumps(recipe,indent=2)+'\n')
items=[]
for c in json.load(open(p))['cases']:
 a=json.load(open(b/'nemo-ctc110-alignment'/f"{c['id']}.json"));rs=[]
 for q in a['candidates']:
  crossing=[{'token':s['token'],'startFrame':s['startFrame'],'endFrame':s['endFrame'],'cellEndSample':s['endFrame']*1280,'physicalEndSample':c['frames']} for s in q.get('spans',[]) if s['endFrame']*1280>c['frames'] or s['startFrame']<0]
  rs.append({'text':q['text'],'outcome':'refused_unowned_support' if crossing else 'conditional_path_text_unknown','lexicalAssignment':'unknown','assignmentConfidence':None,'sourcePhysicalFrames':c['frames'],'nativeFrameSamples':1280,'unownedSpans':crossing,'arithmeticReportSha256':digest(b/'nemo-ctc110-alignment'/f"{c['id']}.json")})
 items.append({'id':c['id'],'candidates':rs})
out={'cases':items,'originalOperandsUnchanged':True,'acceptedForVerifiedTimedWords':False,'candidateScope':'Conditional text-placement evidence with explicit lexical uncertainty and unowned-support refusal. Not lexical or partial-fragment recognition.'}
(d/'report.json').write_text(json.dumps(out,indent=2)+'\n')
print([(i['id'],[q['outcome'] for q in i['candidates']]) for i in items])
