import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tonePitch,requirePitchAcceptance} from '/Users/david/dev/screen-recorder/packages/test-harness/editing/stretch-measurements.mjs';
const out=dirname(fileURLToPath(import.meta.url)),root='/Users/david/dev/screen-recorder';
const source=join(root,'specs/agent-editing/assets/13a-endpoint-verification/auditions/phrase-0-reference.wav');
const worker=join(root,'helpers/stretch/.build/release/StretchParity');
const hash=b=>createHash('sha256').update(b).digest('hex');
const original=readFileSync(source),workerBytes=readFileSync(worker);
assert.equal(hash(original),'afb2a082d6712beef71dae54a89060710e62f9ee0db6e69c5e4eae029cf5bb0c');
assert.equal(hash(workerBytes),'1cf7c24c73ba4b6ca3c05aa41fdccb07d62a5ea8ce65c66236bdf4b75743addc');
assert.equal(original.toString('ascii',36,40),'data');
const pcm=original.subarray(44);assert.equal(pcm.length,231360*4);
const wav=(name,data)=>{const h=Buffer.from(original.subarray(0,44));h.writeUInt32LE(data.length+36,4);h.writeUInt32LE(data.length,40);writeFileSync(join(out,name),Buffer.concat([h,data]));};
writeFileSync(join(out,'original.wav'),original);
wav('protected-opening-reference.wav',pcm.subarray(0,22560*4));
wav('protected-ending-reference.wav',pcm.subarray(91680*4));
writeFileSync(join(out,'input.f32'),pcm);
const commands=[];
function run(name,input,start,end,wanted){
 const args=[join(out,input),join(out,name+'.f32'),String(start),String(end),String(wanted),'48000'];
 const p=spawnSync(worker,args,{encoding:'utf8',timeout:60000});commands.push({worker,args,status:p.status,stdout:p.stdout,stderr:p.stderr,error:p.error?.message});writeFileSync(join(out,'commands.json'),JSON.stringify(commands,null,2)+'\n');
 assert.equal(p.status,0,p.stderr||p.error?.message);const b=readFileSync(join(out,name+'.f32'));assert.equal(b.length,wanted*4);for(let i=0;i<wanted;i++)assert(Number.isFinite(b.readFloatLE(i*4)));return b;
}
const retimed=run('short-word','input.f32',0,22560,28200);
const poison=Buffer.from(pcm);for(let i=22560;i<231360;i++)poison.writeFloatLE(i%2?0.9:-0.9,i*4);writeFileSync(join(out,'poison-input.f32'),poison);
assert.deepEqual(run('short-word-poison','poison-input.f32',0,22560,28200),retimed);
writeFileSync(join(out,'selected.f32'),pcm.subarray(0,22560*4));assert.deepEqual(run('short-word-selected-only','selected.f32',0,22560,28200),retimed);
const candidate=Buffer.concat([retimed,pcm.subarray(22560*4)]);assert.equal(candidate.length,237000*4);assert.deepEqual(candidate.subarray(28200*4),pcm.subarray(22560*4));wav('short-word-slower-0.8x.wav',candidate);
const tone=Buffer.alloc(22560*4);for(let i=0;i<22560;i++)tone.writeFloatLE(0.2*Math.sin(2*Math.PI*120*i/48000),i*4);writeFileSync(join(out,'tone-input.f32'),tone);
const toneOut=run('tone-output','tone-input.f32',0,22560,28200),pitch=tonePitch(toneOut,120);writeFileSync(join(out,'pitch.json'),JSON.stringify(pitch,null,2)+'\n');requirePitchAcceptance(pitch,'same-count120Hz');
assert.deepEqual(readFileSync(source),original);assert.deepEqual(readFileSync(worker),workerBytes);
const report={source,sourceSha256:hash(original),worker,workerSha256:hash(workerBytes),text:'Okay, so this is the recorder workbench.',boundaryAuthority:'Explicitly authored inherited-ASR gaps; proposed word containment only, no independent annotation or listening verdict',protectedReferenceSpans:[{path:'protected-opening-reference.wav',frames:[0,22560],proposedText:'Okay'},{path:'protected-ending-reference.wav',frames:[91680,231360],proposedText:'recorder workbench'}],shortSpeech:{proposedText:'Okay',selectedFrames:[0,22560],sourceFileRangeUs:[1050000,1520000],speed:{numerator:4,denominator:5},outputSelectedFrames:28200,outputContextFrames:237000,joinSeconds:0.5875,admission:'Actual frozen-worker request succeeded; no fallback/preset switch',checks:{exactCount:true,finite:true,unchangedRest:true,excludedSourcePoisonIdentical:true,selectedOnlyIdentical:true},retimedPcmSha256:hash(retimed)},tone:{inputFrames:22560,outputFrames:28200,pitch,measurementSourceSha256:hash(readFileSync(join(root,'packages/test-harness/editing/stretch-measurements.mjs')))},policy:'Explicit selected PCM only; no added context, padding, fade, gain, new model/build or public adoption',listening:'UNVERIFIED; containment and short-word quality await independent judgment',files:[]};
for(const path of ['original.wav','protected-opening-reference.wav','protected-ending-reference.wav','short-word-slower-0.8x.wav','tone-input.f32','tone-output.f32','render.mjs','commands.json','pitch.json']){const b=readFileSync(join(out,path));report.files.push({path,bytes:b.length,sha256:hash(b)});}
writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
