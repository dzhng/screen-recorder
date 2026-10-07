import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {diarizationScore} from '/Users/server/dev/yap-video-editing/packages/test-harness/speech/feasibility/score.mjs';
const b='/tmp/yap-editing-speaker-replication/low-latency';const protocol=JSON.parse(await readFile(b+'/protocol.json','utf8'));
function overlapRecall(ref,pred,duration){
 const points=[...new Set([0,duration,...ref.flatMap(x=>[x.start,x.end]),...pred.flatMap(x=>[x.start,x.end])])].sort((a,b)=>a-b);
 let total=0,retained=0;
 for(let i=1;i<points.length;i++){
  const at=(points[i]+points[i-1])/2;const n=ref.filter(x=>x.start<=at&&x.end>at).length;
  if(n<2)continue;const dt=points[i]-points[i-1];total+=dt;
  if(new Set(pred.filter(x=>x.start<=at&&x.end>at).map(x=>x.speaker)).size>=2)retained+=dt;
 }
 return{referenceOverlapSeconds:total,retainedOverlapSeconds:retained,recall:total?retained/total:null};
}
const reports=[];
for(const c of protocol.cases){
 const raw=JSON.parse(await readFile(c.output,'utf8'));const metrics=diarizationScore(c.reference,raw.segments,raw.audioSeconds);const overlap=overlapRecall(c.reference,raw.segments,raw.audioSeconds);
 const confusionRatio=metrics.confusedSpeakerSeconds/metrics.referenceSpeakerSeconds;
 const passed=metrics.der<=protocol.gates.everyCaseDERMaximum&&confusionRatio<=protocol.gates.globalIdentityConfusionRatioMaximum&&(overlap.recall===null||overlap.recall>=protocol.gates.overlapRecallMinimum)&&raw.inferenceSeconds<=raw.audioSeconds*2&&raw.peakProcessRSSBytes<=4294967296;
 reports.push({id:c.id,role:c.role,passed,metrics,confusionRatio,overlap,inferenceSeconds:raw.inferenceSeconds,peakProcessRSSBytes:raw.peakProcessRSSBytes});
}
await writeFile(b+'/scores.json',JSON.stringify({passed:reports.every(x=>x.passed),cases:reports},null,2),{flag:'wx'});
console.log(JSON.stringify(reports.map(x=>({id:x.id,passed:x.passed,der:x.metrics.der,confusionRatio:x.confusionRatio,overlapRecall:x.overlap.recall,seconds:x.inferenceSeconds,RSS:x.peakProcessRSSBytes})),null,2));
