// Data-only alternative interpretation, preserving every original native operand.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {diarizationScore} from '/Users/server/dev/yap-video-editing/packages/test-harness/speech/feasibility/score.mjs';
const b='/tmp/yap-editing-speaker-replication';const dir=b+'/nemotron-threshold';await mkdir(dir);
const protocol={status:'frozen-before-candidate-analysis',candidateThresholds:[.5,.4,.3,.2,.1,.05,.02,.01,.005],semantics:'Same scalar onset/offset for all four columns; strict native > onset/< offset; each10ms native row used once; no padding/filter; physical last native10ms endpoint retained. No probability calibration claim.',calibrationSource:'bspxd only',calibrationCases:['bspxd30','returns-overlap-silence'],heldOutCases:['aiqwk30'],selection:'Among profiles passing every calibration case, minimize pooled DER; higher threshold wins exact tie. Freeze selection before opening aiqwk alternative results.',gates:{everyCaseDERMaximum:.2,globalIdentityConfusionRatioMaximum:.05,overlapRecallMinimum:.8},caveat:'Original aiqwk at0.5 previously observed failing; alternative thresholds not selected against aiqwk. These are interpretation-held-out cases, not an untouched/training-held-out dataset.'};
await writeFile(dir+'/protocol.json',JSON.stringify(protocol,null,2),{flag:'wx'});
const frozen=JSON.parse(await readFile(b+'/nemotron-feasibility/protocol.json','utf8'));
function interpret(raw,threshold){
 const turns=[];const matrix=raw.nativeProbabilities;
 for(let slot=0;slot<8;slot++){
  let active=false,start=0;
  for(let frame=0;frame<matrix.length;frame++){
   const score=matrix[frame][slot];
   if(active&&score<threshold){turns.push({speaker:'speaker_'+slot,start,end:Math.round(frame*.01*100)/100});active=false;}
   else if(!active&&score>threshold){start=Math.round(frame*.01*100)/100;active=true;}
  }
  if(active)turns.push({speaker:'speaker_'+slot,start,end:Math.round((matrix.length-1)*.01*100)/100});
 }
 return turns;
}
function overlap(ref,pred,duration){
 const points=[...new Set([0,duration,...ref.flatMap(x=>[x.start,x.end]),...pred.flatMap(x=>[x.start,x.end])])].sort((a,b)=>a-b);let total=0,retained=0;
 for(let i=1;i<points.length;i++){
  const mid=(points[i]+points[i-1])/2;
  if(new Set(ref.filter(x=>x.start<=mid&&x.end>mid).map(x=>x.speaker)).size<2)continue;
  const dt=points[i]-points[i-1];total+=dt;
  if(new Set(pred.filter(x=>x.start<=mid&&x.end>mid).map(x=>x.speaker)).size>=2)retained+=dt;
 }
 return total?retained/total:null;
}
function evaluate(c,raw,t){
 const segments=interpret(raw,t);const metrics=diarizationScore(c.reference,segments,raw.audioSeconds);
 const overlapRecall=overlap(c.reference,segments,raw.audioSeconds);const confusionRatio=metrics.confusedSpeakerSeconds/metrics.referenceSpeakerSeconds;
 return {id:c.id,threshold:t,metrics,overlapRecall,confusionRatio,passed:metrics.der<=.2&&confusionRatio<=.05&&(overlapRecall===null||overlapRecall>=.8)};
}
const calibration=[];
for(const c of frozen.cases.filter(x=>protocol.calibrationCases.includes(x.id))){
 const raw=JSON.parse(await readFile(c.output,'utf8'));
 assert.deepEqual(interpret(raw,.5),raw.segments,'data-only native0.5 postprocessing parity must pass before alternatives');
 calibration.push({case:c,raw});
}
const candidates=protocol.candidateThresholds.map(t=>{
 const cases=calibration.map(x=>evaluate(x.case,x.raw,t));
 const seconds=cases.reduce((n,c)=>n+c.metrics.referenceSpeakerSeconds,0);
 const errors=cases.reduce((n,c)=>n+c.metrics.missedSpeakerSeconds+c.metrics.falseSpeakerSeconds+c.metrics.confusedSpeakerSeconds,0);
 return {threshold:t,passed:cases.every(x=>x.passed),pooledDER:errors/seconds,cases};
});
const winner=candidates.filter(x=>x.passed).sort((a,b)=>a.pooledDER-b.pooledDER||b.threshold-a.threshold)[0];assert(winner);
await writeFile(dir+'/selection.json',JSON.stringify({selected: winner.threshold,candidates},null,2),{flag:'wx'});
const aiqwk=frozen.cases.find(x=>x.id==='aiqwk30');const raw=JSON.parse(await readFile(aiqwk.output,'utf8'));assert.deepEqual(interpret(raw,.5),raw.segments);
const heldOut=[evaluate(aiqwk,raw,winner.threshold)];
await writeFile(dir+'/held-out.json',JSON.stringify({passed:heldOut.every(x=>x.passed),selectedThreshold:winner.threshold,cases:heldOut},null,2),{flag:'wx'});
console.log(JSON.stringify({selectedThreshold:winner.threshold,calibration:candidates.map(x=>({threshold:x.threshold,passed:x.passed,pooledDER:x.pooledDER})),heldOut},null,2));
