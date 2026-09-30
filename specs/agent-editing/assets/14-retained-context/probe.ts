import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {applyBatch,validateComposition,createCompiler} from '/Users/david/dev/screen-recorder/packages/composition/src/index.ts';
const media=[{id:'asset',streams:[{id:'audio',kind:'audio',bounds:{startUs:0,endUs:4820000},available:[{startUs:0,endUs:4820000}]}]}];
const input={canvas:{width:16,height:16,fps:{numerator:30,denominator:1},background:'#000000ff'},tracks:[{id:'a',kind:'audio',order:0}],groups:[],processing:[],syncGroups:[],clips:[{id:'voice',trackId:'a',assetId:'asset',streamId:'audio',source:{kind:'range',range:{startUs:650125,endUs:1910000}},placement:{kind:'project',range:{startUs:650125,endUs:2224968.75}},pitch:'preserve'}]};
// Exact rational project endpoint, not a rounded public edit duration.
input.clips[0].placement.range.endUs={numerator:8899875,denominator:4} as any;
const compile=(doc:any,range={startUs:650125,endUs:2224970})=>[...createCompiler(validateComposition(doc,media),'probe').audio(range,48000)];
const base=compile(input);const expected={source:{startUs:650125,endUs:1910000},sampleRange:{start:31206,end:106798}};
assert.deepEqual(base[0].context,[expected]);
const split=applyBatch(input,[{operation:'split',clipIds:['voice'],atUs:1234567,scope:'selected'}],{assets:media,namespace:'split'});
const divided=compile(split.document);assert.equal(divided.length,2);for(const part of divided)assert.deepEqual(part.context,[expected]);
const window=compile(split.document,{startUs:1500000,endUs:1600000});assert.deepEqual(window[0].context,[expected]);
const cut=applyBatch(input,[{operation:'remove',clipIds:['voice'],ranges:[{startUs:1200000,endUs:1300000}],scope:'selected',ripple:'none'}],{assets:media,namespace:'cut'});
const cutParts=compile(cut.document);assert.equal(cutParts.length,2);assert.notDeepEqual(cutParts[0].context,cutParts[1].context);assert.equal(cutParts[0].context[0].sampleRange.end,57600);assert.equal(cutParts[1].context[0].sampleRange.start,62400);
const report={scope:'Pure compiler context proof only; no native retiming or acoustic acceptance',base,divided,window,cutParts,checks:{sameFullRunAfterSplit:true,sameFullRunInShortWindow:true,gapBreaksRun:true,correctedCandidateOutputCount:expected.sampleRange.end-expected.sampleRange.start},caveat:'Exact rational model endpoint; public retime duration uses integer microseconds and needs separate production mapping verification.'};
writeFileSync('/tmp/screenrec-retime-context-check/report.json',JSON.stringify(report,null,2)+'\n');console.log('PASS retained retime contexts: split/window preserve full run; removed gap splits support');
