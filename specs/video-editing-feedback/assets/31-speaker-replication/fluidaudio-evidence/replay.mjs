// Replay retained public provider observations; no inference, acquisition or writes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {dirname,join,basename} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));const repo=process.argv[2];assert(repo,'Pass repository root for the existing scorer');
const {diarizationScore}=await import(pathToFileURL(join(repo,'packages/test-harness/speech/feasibility/score.mjs')));
const read=p=>JSON.parse(readFileSync(join(root,p)));const compressed=p=>JSON.parse(gunzipSync(readFileSync(join(root,p+'.gz'))));const hash=x=>createHash('sha256').update(x).digest('hex');
for(const f of read('operands.json').files)assert.equal(hash(readFileSync(join(root,f.path))),f.sha256,f.path);
const p=read('protocol.json');const manifest=read('manifest.json');const readiness=read('readiness.json');const retained=read('scores.json');
assert.equal(hash(readFileSync(join(root,'manifest.json'))),p.manifestSha256);assert.equal(hash(readFileSync(join(root,'reference.swift'))),p.workerSourceSha256);
assert.equal(hash(JSON.stringify(read('source-closure.json').entries)),p.sourceClosureDigest);assert.equal(manifest.folderName,'speaker-diarization');assert.equal(manifest.revision,'df2625ac79a7ac6b65ad868fee6d80f320da4232');
assert.deepEqual(readiness.files,manifest.files);assert.equal(readiness.state,'ready');assert.equal(readiness.networkDenied,true);assert.equal(readiness.qualityReady,false);
const transport=read('transport-r3.json');assert.equal(transport.result.ok,true);assert.equal(transport.result.data.offlineModelsLoaded,true);
assert.equal(p.config.postProcessing.exclusiveSegments,false);assert.equal(p.config.exposeChunkEmbeddings,true);assert.equal(p.config.clustering.numSpeakers,null);assert.equal(p.config.clustering.minSpeakers,null);assert.equal(p.config.clustering.maxSpeakers,null);
function overlap(ref,pred,duration){const points=[...new Set([0,duration,...ref.flatMap(x=>[x.start,x.end]),...pred.flatMap(x=>[x.start,x.end])])].sort((a,b)=>a-b);let total=0,retained=0;for(let i=1;i<points.length;i++){const mid=(points[i]+points[i-1])/2;if(new Set(ref.filter(x=>x.start<=mid&&x.end>mid).map(x=>x.speaker)).size<2)continue;const dt=points[i]-points[i-1];total+=dt;if(new Set(pred.filter(x=>x.start<=mid&&x.end>mid).map(x=>x.speaker)).size>=2)retained+=dt;}return{referenceOverlapSeconds:total,retainedOverlapSeconds:retained,recall:total?retained/total:null};}
const cases=[];
for(const c of p.cases){
 const raw=compressed(basename(c.output));assert.equal(raw.pcmSha256,c.pcmSha256);assert.equal(raw.sourceFrames,c.frames);assert.equal(raw.audioSeconds,c.frames/16000);assert.equal(raw.rawModelLogitsRetained,false);
 for(const e of raw.chunkEmbeddings){assert.equal(e.embedding256.length,256);assert.equal(e.rho128.length,128);assert(e.embedding256.every(Number.isFinite));assert(e.rho128.every(Number.isFinite));}
 const segments=raw.segments.map(({speaker,start,end})=>({speaker,start,end}));let metrics=null,scoreRefusal=null;try{metrics=diarizationScore(c.reference,segments,raw.audioSeconds);}catch(error){scoreRefusal=error.message;}
 const ov=overlap(c.reference,segments,raw.audioSeconds);const confusionRatio=metrics?metrics.confusedSpeakerSeconds/metrics.referenceSpeakerSeconds:null;const countMatches=new Set(segments.map(x=>x.speaker)).size===new Set(c.reference.map(x=>x.speaker)).size;
 const sourceSupportValid=segments.every(x=>Number.isFinite(x.start)&&Number.isFinite(x.end)&&x.start>=0&&x.end>=x.start&&x.end<=raw.audioSeconds);
 const passed=countMatches&&sourceSupportValid&&metrics!==null&&metrics.der<=p.gates.everyCaseDERMaximum&&confusionRatio<=p.gates.globalIdentityConfusionRatioMaximum&&(ov.recall===null||ov.recall>=p.gates.overlapRecallMinimum)&&raw.inferenceSeconds<=raw.audioSeconds*p.gates.inferenceWallAudioRatioMaximum&&raw.peakProcessRSSBytes<=p.gates.RSSBytesMaximum;
 const actual={id:c.id,role:c.role,passed,sourceSupportValid,countMatches,scoreRefusal,metrics,confusionRatio,overlap:ov,inferenceSeconds:raw.inferenceSeconds,peakProcessRSSBytes:raw.peakProcessRSSBytes,publicChunkEmbeddingCount:raw.chunkEmbeddings.length,rawModelLogitsRetained:raw.rawModelLogitsRetained};assert.deepEqual(actual,retained.cases.find(x=>x.id===c.id));cases.push(actual);
}
assert(cases.every(x=>!x.passed));assert.equal(retained.passed,false);assert.equal(cases.find(x=>x.id==='aiqwk30').countMatches,false);
console.log(JSON.stringify({verified:true,slice31Complete:false,providerModelClosureReady:true,providerQualityReady:false,cases},null,2));
