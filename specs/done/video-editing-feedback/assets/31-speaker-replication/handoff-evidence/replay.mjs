// Frozen research replay; no models, network, media acquisition or writes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
const repo=process.argv[2];assert(repo,'Pass repository root for existing diarization scorer');
const {diarizationScore}=await import(pathToFileURL(join(repo,'packages/test-harness/speech/feasibility/score.mjs')));
const read=p=>JSON.parse(readFileSync(join(root,p)));
const compressed=p=>JSON.parse(gunzipSync(readFileSync(join(root,p+'.gz'))));
const hash=data=>createHash('sha256').update(data).digest('hex');
function overlapRecall(ref,pred,duration){
 const points=[...new Set([0,duration,...ref.flatMap(x=>[x.start,x.end]),...pred.flatMap(x=>[x.start,x.end])])].sort((a,b)=>a-b);
 let total=0,retained=0;
 for(let i=1;i<points.length;i++){
  const at=(points[i]+points[i-1])/2;
  if(new Set(ref.filter(x=>x.start<=at&&x.end>at).map(x=>x.speaker)).size<2)continue;
  const dt=points[i]-points[i-1];total+=dt;
  if(new Set(pred.filter(x=>x.start<=at&&x.end>at).map(x=>x.speaker)).size>=2)retained+=dt;
 }
 return{referenceOverlapSeconds:total,retainedOverlapSeconds:retained,recall:total?retained/total:null};
}
for(const file of read('operands.json').files)assert.equal(hash(readFileSync(join(root,file.path))),file.sha256,file.path);
const preservation=read('evidence/frozen-preservation-protocol.json');
const actual=compressed('evidence/bspxd.json');
const original=JSON.parse(readFileSync(join(repo,'specs/done/ffmpeg-parity/evidence/speaker-original/bspxd.json')));
for(const field of preservation.exactFields)assert.deepEqual(actual[field],original[field],field);
const descriptor=compressed('evidence/private-manifest.json');
assert.equal(hash(JSON.stringify(descriptor.runtimeArtifact.entries)),preservation.runtimeDigest);
assert.equal(read('evidence/preservation-comparison.json').passed,true);
assert.equal(read('evidence/streaming-source-comparison.json').passed,true);
const rows=[];
for(const folder of ['continuity','three-long','long-absence-v2']){
 const protocol=read(folder+'/protocol.json');const scores=read(folder+'/scores.json');
 assert.equal(hash(readFileSync(join(root,'lab-worker.py'))),protocol.workerSha256);
 for(const c of protocol.cases){
  const name=c.output.split('/').at(-1);const raw=compressed(folder+'/'+name);
  const retained=scores.cases.find(x=>x.id===c.id);assert(retained);
  assert.equal(raw.pcmSha256,c.pcmSha256);assert.equal(raw.sourceFrames,c.frames);
  assert.deepEqual(diarizationScore(c.reference,raw.segments,raw.audioSeconds),retained.metrics);
  const overlap=overlapRecall(c.reference,raw.segments,raw.audioSeconds);
  assert.deepEqual(overlap,retained.overlap);
  let passed=retained.metrics.der<=protocol.gates.everyCaseDERMaximum&&
   retained.metrics.confusedSpeakerSeconds/retained.metrics.referenceSpeakerSeconds<=protocol.gates.globalIdentityConfusionRatioMaximum&&
   (overlap.recall===null||overlap.recall>=protocol.gates.overlapRecallMinimum)&&
   raw.inferenceSeconds<=raw.audioSeconds*protocol.gates.inferenceWallAudioRatioMaximum&&raw.peakProcessRSSBytes<=protocol.gates.RSSBytesMaximum;
  if(protocol.postReturn){
   const post=protocol.postReturn;const slot=Object.keys(retained.metrics.mapping).find(k=>retained.metrics.mapping[k]===post.speaker);
   const coverage=raw.segments.filter(x=>x.speaker===slot).reduce((n,x)=>n+Math.max(0,Math.min(x.end,post.end)-Math.max(x.start,post.start)),0)/(post.end-post.start);
   const silence=protocol.silence;const falseSilence=raw.segments.reduce((n,x)=>n+Math.max(0,Math.min(x.end,silence.end)-Math.max(x.start,silence.start)),0);
   assert.equal(coverage,retained.postReturnIdentityCoverage);assert.equal(falseSilence,retained.silenceFalseSpeakerSeconds);
   passed=passed&&coverage>=protocol.gates.postReturnIdentityCoverageMinimum&&falseSilence<=silence.maximumFalseSpeakerSeconds;
  }
  assert.equal(passed,retained.passed);
  const native=compressed(folder+'/'+name+'.native-unverified.json');
  assert.deepEqual(native.nativeSegmentLines,[raw.nativeSegmentLines]);
  const bytes=Buffer.from(native.bytesBase64,'base64');
  assert.equal(bytes.length,raw.nativeProbabilities.length*16);
  for(let i=0;i<raw.nativeProbabilities.length;i++)for(let j=0;j<4;j++)assert.equal(bytes.readFloatLE((i*4+j)*4),raw.nativeProbabilities[i][j]);
  rows.push({id:c.id,passed:retained.passed,der:retained.metrics.der});
 }
}
assert.equal(rows.find(x=>x.id==='four-speaker600').passed,false);
assert(rows.filter(x=>x.id!=='four-speaker600').every(x=>x.passed));
assert.equal(read('continuity/scores.json').plantedSwap.rejected,true);
const longProtocol=read('continuity/protocol.json');const longCase=longProtocol.cases.find(x=>x.id==='four-speaker600');
const longRaw=compressed('continuity/four-speaker600.json');
const swapped=longRaw.segments.flatMap(x=>{
 const split=x.start<300&&x.end>300?[{...x,end:300},{...x,start:300}]:[x];
 return split.map(y=>y.start>=300?{...y,speaker:y.speaker==='speaker_0'?'speaker_1':y.speaker==='speaker_1'?'speaker_0':y.speaker}:y);
});
const planted=diarizationScore(longCase.reference,swapped,600);
assert.deepEqual(planted,read('continuity/scores.json').plantedSwap.metrics);
assert(planted.confusedSpeakerSeconds/planted.referenceSpeakerSeconds>.05);
assert.equal(read('long-absence/invalid-control.json').valid,false);
console.log(JSON.stringify({verified:true,slice31Complete:false,cases:rows},null,2));
