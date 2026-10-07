// Frozen raw-operand replay; no models, acquisition, inference, tuning or writes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {dirname,join,basename} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
const repo=process.argv[2];assert(repo,'Pass repository root for the existing scorer');
const originalRoot=process.argv[3]??join(root,'../handoff-evidence');
const {diarizationScore}=await import(pathToFileURL(join(repo,'packages/test-harness/speech/feasibility/score.mjs')));
const json=(p)=>JSON.parse(readFileSync(p));
const read=p=>json(join(root,p));
const compressed=(base,p)=>JSON.parse(gunzipSync(readFileSync(join(base,p+'.gz'))));
const hash=d=>createHash('sha256').update(d).digest('hex');
for(const f of read('operands.json').files)assert.equal(hash(readFileSync(join(root,f.path))),f.sha256,f.path);
function overlap(ref,pred,duration){
 const points=[...new Set([0,duration,...ref.flatMap(x=>[x.start,x.end]),...pred.flatMap(x=>[x.start,x.end])])].sort((a,b)=>a-b);
 let total=0,retained=0;
 for(let i=1;i<points.length;i++){
  const mid=(points[i]+points[i-1])/2;
  if(new Set(ref.filter(x=>x.start<=mid&&x.end>mid).map(x=>x.speaker)).size<2)continue;
  const dt=points[i]-points[i-1];total+=dt;
  if(new Set(pred.filter(x=>x.start<=mid&&x.end>mid).map(x=>x.speaker)).size>=2)retained+=dt;
 }
 return{referenceOverlapSeconds:total,retainedOverlapSeconds:retained,recall:total?retained/total:null};
}
function interpret(raw,t){
 const turns=[];const matrix=raw.nativeProbabilities;const step=raw.frameSeconds;const slots=raw.probabilityShape.at(-1);
 for(let slot=0;slot<slots;slot++){
  let active=false,start=0;
  for(let frame=0;frame<matrix.length;frame++){
   const score=matrix[frame][slot];const time=Math.round(frame*step*100)/100;
   if(active&&score<t){turns.push({speaker:'speaker_'+slot,start,end:time});active=false;}
   else if(!active&&score>t){start=time;active=true;}
  }
  const end=step===.08?Math.round((matrix.length*8-1)*.01*100)/100:Math.round(matrix.length*.01*100)/100;
  if(active)turns.push({speaker:'speaker_'+slot,start,end});
 }
 return turns;
}
const inference=[];
for(const folder of ['low-latency','nemotron-feasibility']){
 const p=read(folder+'/protocol.json');const s=read(folder+'/scores.json');
 assert.equal(hash(readFileSync(join(root,folder==='low-latency'?'low-latency-worker.py':'nemotron-worker.py'))),p.workerSha256);
 for(const c of p.cases){
  const path=folder+'/'+basename(c.output);const raw=compressed(root,path);const native=compressed(root,path+'.native-unverified.json');
  assert.equal(raw.pcmSha256,c.pcmSha256);assert.equal(raw.sourceFrames,c.frames);assert.deepEqual(raw.config,p.recipe);
  assert.deepEqual(native.shape,raw.probabilityShape);assert.equal(native.dtype,'<f4');assert.deepEqual(native.nativeSegmentLines,[raw.nativeSegmentLines]);
  const bytes=Buffer.from(native.bytesBase64,'base64');const slots=raw.probabilityShape.at(-1);assert.equal(bytes.length,raw.nativeProbabilities.length*slots*4);
  for(let i=0;i<raw.nativeProbabilities.length;i++)for(let j=0;j<slots;j++)assert.equal(bytes.readFloatLE((i*slots+j)*4),raw.nativeProbabilities[i][j]);
  assert.deepEqual(interpret(raw,.5),raw.segments,'exact native0.5 comparator');
  const metrics=diarizationScore(c.reference,raw.segments,raw.audioSeconds);const ov=overlap(c.reference,raw.segments,raw.audioSeconds);const confusionRatio=metrics.confusedSpeakerSeconds/metrics.referenceSpeakerSeconds;
  const countMatches=new Set(raw.segments.map(x=>x.speaker)).size===new Set(c.reference.map(x=>x.speaker)).size;
  const passed=(!p.gates.everyCaseObservedSpeakerCountMatchesReference||countMatches)&&metrics.der<=p.gates.everyCaseDERMaximum&&confusionRatio<=p.gates.globalIdentityConfusionRatioMaximum&&(ov.recall===null||ov.recall>=p.gates.overlapRecallMinimum)&&raw.inferenceSeconds<=raw.audioSeconds*p.gates.inferenceWallAudioRatioMaximum&&raw.peakProcessRSSBytes<=p.gates.RSSBytesMaximum;
  const retained=s.cases.find(x=>x.id===c.id);assert.deepEqual(metrics,retained.metrics);assert.deepEqual(ov,retained.overlap);assert.equal(confusionRatio,retained.confusionRatio);assert.equal(passed,retained.passed);
  if('countMatches'in retained)assert.equal(countMatches,retained.countMatches);
  inference.push({provider:folder,id:c.id,der:metrics.der,overlapRecall:ov.recall,countMatches,passed});
 }
 assert.equal(s.passed,false);assert.equal(s.cases.find(x=>x.role==='held-out').passed,false);
}
function evalThreshold(c,raw,t,countGate){
 const segments=interpret(raw,t);const metrics=diarizationScore(c.reference,segments,raw.audioSeconds);const overlapRecall=overlap(c.reference,segments,raw.audioSeconds).recall;
 const confusionRatio=metrics.confusedSpeakerSeconds/metrics.referenceSpeakerSeconds;const countMatches=new Set(segments.map(x=>x.speaker)).size===new Set(c.reference.map(x=>x.speaker)).size;
 return{id:c.id,threshold:t,metrics,overlapRecall,confusionRatio,...(countGate?{countMatches}:{}),passed:(!countGate||countMatches)&&metrics.der<=.2&&confusionRatio<=.05&&(overlapRecall===null||overlapRecall>=.8)};
}
const interpretations=[];
for(const folder of ['threshold-research','nemotron-threshold-r2','nemotron-overlap-priority']){
 const p=read(folder+'/protocol.json');const selection=read(folder+'/selection.json');const held=read(folder+'/held-out.json');const countGate=!!p.gates.speakerCountMustMatch;
 const original=folder==='threshold-research';const frozen=original?json(join(originalRoot,'continuity/protocol.json')):read('nemotron-feasibility/protocol.json');
 const loadCase=c=>original?compressed(originalRoot,'continuity/'+basename(c.output)):compressed(root,'nemotron-feasibility/'+basename(c.output));
 const calibration=frozen.cases.filter(x=>p.calibrationCases.includes(x.id)).map(c=>({c,raw:loadCase(c)}));
 for(const x of calibration)assert.deepEqual(interpret(x.raw,.5),x.raw.segments);
 const candidates=p.candidateThresholds.map(t=>{
  const cases=calibration.map(x=>evalThreshold(x.c,x.raw,t,countGate));const seconds=cases.reduce((n,c)=>n+c.metrics.referenceSpeakerSeconds,0);const errors=cases.reduce((n,c)=>n+c.metrics.missedSpeakerSeconds+c.metrics.falseSpeakerSeconds+c.metrics.confusedSpeakerSeconds,0);
  return{threshold:t,passed:cases.every(x=>x.passed),...(countGate?{worstOverlapRecall:Math.min(...cases.filter(x=>x.overlapRecall!==null).map(x=>x.overlapRecall))}:{}),pooledDER:errors/seconds,cases};
 });
 assert.deepEqual(candidates,selection.candidates);
 const passing=candidates.filter(x=>x.passed).sort(countGate?(a,b)=>b.worstOverlapRecall-a.worstOverlapRecall||b.threshold-a.threshold:(a,b)=>a.pooledDER-b.pooledDER||b.threshold-a.threshold);
 assert.equal(passing[0].threshold,selection.selected);
 const heldCases=frozen.cases.filter(x=>p.heldOutCases.includes(x.id)).map(c=>({c,raw:loadCase(c)}));
 if(original){
  const c=json(join(repo,'specs/done/ffmpeg-parity/evidence/speaker-cohort/selection.json')).cases.find(x=>x.id==='aiqwk');const raw=json(join(repo,'specs/done/ffmpeg-parity/evidence/speaker-original/aiqwk.json'));heldCases.push({c:{...c,id:'original-aiqwk30'},raw});
 }
 const results=heldCases.map(x=>{assert.deepEqual(interpret(x.raw,.5),x.raw.segments);return evalThreshold(x.c,x.raw,selection.selected,countGate);});
 assert.deepEqual(results,held.cases);assert.equal(held.selectedThreshold,selection.selected);assert.equal(held.passed,false);assert(results.every(x=>!x.passed));
 interpretations.push({recipe:folder,selectedThreshold:selection.selected,cases:results.map(x=>({id:x.id,der:x.metrics.der,overlapRecall:x.overlapRecall,...('countMatches'in x?{countMatches:x.countMatches}:{}),passed:x.passed}))});
}
console.log(JSON.stringify({verified:true,slice31Complete:false,newProviderRelocatedClosure:false,inference,interpretations},null,2));
