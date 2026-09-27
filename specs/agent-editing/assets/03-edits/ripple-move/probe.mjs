import assert from 'node:assert/strict';
import {applyBatch,validateComposition,projectToSource} from '../../../../../packages/composition/dist/index.js';
const assets=[{id:'s',streams:[{id:'v',kind:'video',bounds:{startUs:0,endUs:20},available:[{startUs:0,endUs:20}]}]}];
for (const divisor of [1, 3]) {
const time=n=>n%divisor===0?n/divisor:{numerator:n,denominator:divisor};
let cases=0,queries=0;
for(let a=1;a<=10;a++) for(let b=1;b<=10;b++) for(let destination=0;destination<=Math.floor(b/divisor);destination++) {
 const document={canvas:{width:16,height:16,fps:{numerator:30,denominator:1},background:'#000000ff'},tracks:[{id:'v',kind:'video',order:0}],clips:[{id:'moving',assetId:'s',streamId:'v',trackId:'v',source:{kind:'range',range:{startUs:0,endUs:a}},placement:{kind:'project',range:{startUs:0,endUs:time(a)}}},{id:'stationary',assetId:'s',streamId:'v',trackId:'v',source:{kind:'range',range:{startUs:0,endUs:b}},placement:{kind:'project',range:{startUs:time(a),endUs:time(a+b)}}}],syncGroups:[],effects:[],captions:[]};
 const original=structuredClone(document);
 const result=applyBatch(document,[{operation:'move',clipIds:['moving'],atUs:destination,ripple:{trackIds:['v']}}],{assets,namespace:'probe'});
 assert.deepEqual(document,original);
 const model=validateComposition(result.document,assets);
 assert.equal(model.durationUs,Math.ceil((a+b)/divisor));
 for(let at=0;divisor*at<a+b;at++) {
  const rows=projectToSource(model,at);assert.equal(rows.length,1);
  const moving=at>=destination&&divisor*at<divisor*destination+a;
  assert.equal(rows[0].clipId==='moving',moving);
  assert.equal(rows[0].sourceUs,moving?divisor*(at-destination):at<destination?divisor*at:divisor*at-a);
  assert.equal(rows[0].available,true);queries++;
 }
 cases++;
}
console.log(JSON.stringify({divisor,cases,queries,sourcePreserved:true,inputUnchanged:true}));
}
