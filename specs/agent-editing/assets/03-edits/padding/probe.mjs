import assert from 'node:assert/strict';
import {applyBatch,validateComposition,projectToSource} from '../../../../../packages/composition/dist/index.js';
let cases=0,queries=0;
for (const kind of ['video','audio']) for(let duration=1;duration<=20;duration++) for(let supplied=1;supplied<=duration;supplied++) {
 const assets=[{id:'source',streams:[{id:'stream',kind,bounds:{startUs:0,endUs:20},available:[{startUs:0,endUs:20}]}]}];
 const document={canvas:{width:16,height:16,fps:{numerator:30,denominator:1},background:'#000000ff'},tracks:[{id:'track',kind,order:0}],clips:[{id:'target',assetId:'source',streamId:'stream',trackId:'track',source:{kind:'range',range:{startUs:0,endUs:duration}},placement:{kind:'project',range:{startUs:0,endUs:duration}}}],syncGroups:[],effects:[],captions:[]};
 const original=structuredClone(document);
 const result=applyBatch(document,[{operation:'replace',clipId:'target',kind,fit:kind==='video'?'hold':'silence',media:{assetId:'source',streamId:'stream',source:{kind:'range',range:{startUs:0,endUs:supplied}}}}],{assets,namespace:'pad'});
 assert.deepEqual(document,original);
 for(const factor of [1,2]) {
  const changed=factor===1?result:applyBatch(result.document,[{operation:'retime',clipIds:['target'],durationUs:duration*2,ripple:'none'}],{assets,namespace:'stretch'});
  const model=validateComposition(changed.document,assets);assert.equal(model.durationUs,duration*factor);
  for(let at=0;at<duration*factor;at++) {
   const rows=projectToSource(model,at);
   const expected=at<supplied*factor?Math.floor(at/factor):kind==='video'?supplied-1:undefined;
   assert.equal(rows.length,expected===undefined?0:1);
   assert.equal(rows[0]?.sourceUs,expected);queries++;
  }
 }
 cases++;
}
console.log(JSON.stringify({cases,queries,sourceAndEnvelopePreserved:true,inputUnchanged:true}));
