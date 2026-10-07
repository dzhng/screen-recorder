import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
const selections=['madison-tiny','overlap25','false-start','constructed-repeats','fortunate-intact','fortunate-truncated','fortunate-contextual'];
const args=process.argv.slice(2);if(args[0]==='--help'){console.log('Usage: node replay.mjs [--case CASE_ID | --list]\nRead-only retained CTC arithmetic and provider-correspondence replay; no model inference.');process.exit(0);}if(args[0]==='--list'){console.log(selections.join('\n'));process.exit(0);}const selected=args.length?args[0]==='--case'&&args.length===2&&selections.includes(args[1])?args[1]:null:undefined;assert(selected!==null,'Use --help for valid case selection');
const bundle=JSON.parse(await readFile(path.join(root,'bundle.json')));const files=new Map();
for(const r of bundle.files){const stored=await readFile(path.join(root,r.path));assert.equal(stored.length,r.storedBytes);assert.equal(sha(stored),r.storedSha256);const raw=r.compression==='gzip'?gunzipSync(stored):stored;assert.equal(raw.length,r.bytes);assert.equal(sha(raw),r.sha256);files.set(r.source,raw);}
const json=p=>JSON.parse(files.get(p).toString());
let cases=0,candidates=0,outOfSupport=[],clockRepresentationRoundoff=[];
for(const provider of ['fluid-ctc110','nemo-ctc110']){
 const protocol=json(`${provider}/${provider.startsWith('nemo')?'protocol-r2.json':'protocol.json'}`);
 for(const c of protocol.cases.filter(c=>!selected||c.id===selected)){const r=json(`${provider}/${c.id}.json`),n=json(`${provider}/${c.id}.json.native.json`),a=json(`${provider}-alignment/${c.id}.json`),pcm=files.get(`inputs/${c.id}.f32`);assert.equal(sha(pcm),c.pcmSha256);assert.equal(pcm.length,c.frames*4);assert.equal(r.pcmSha256,c.pcmSha256);assert.equal(a.emissionsSha256,sha(files.get(`${provider}/${c.id}.json`)));assert.deepEqual(r.shape,n.shape);const native=Buffer.from(n.bytesBase64,'base64');assert.equal(native.length,r.shape[0]*r.shape[1]*4);assert.deepEqual(native,Buffer.from(r.nativeLogProbBytesBase64,'base64'));
  const T=r.shape[0],C=r.shape[1];const frameSampleNumerator=provider==='nemo-ctc110'?1280:Math.min(r.sourceFrames,240000),frameSampleDenominator=provider==='nemo-ctc110'?1:r.sourceFrames>240000?188:T;assert.equal(r.frameDuration,frameSampleNumerator/frameSampleDenominator/16000);let offset=0;for(const row of r.logProbs)for(const value of row){assert(Number.isFinite(value));assert.equal(native.readFloatLE(offset),value);offset+=4;}
  const greedy=[];let previous=-1;for(const row of r.logProbs){let token=0;for(let k=1;k<C;k++)if(row[k]>row[token])token=k;if(token!==r.blankId&&token!==previous)greedy.push(token);previous=token;}assert.deepEqual(greedy,a.greedyTokenIds);assert.equal(greedy.map(t=>r.vocabulary[String(t)]??'[unknown]').join('').replaceAll('▁',' ').trim(),a.greedyText);
  for(const q of a.candidates){assert.equal(q.assignmentConfidence,null);if(q.status==='refused')continue;assert.equal(q.status,'forced_path_observation');assert.equal(q.path.length,T);assert.equal(q.frameLogScores.length,T);let prev=-1,collapsed=[];for(let t=0;t<T;t++){assert.equal(q.frameLogScores[t],r.logProbs[t][q.path[t]]);if(q.path[t]!==r.blankId&&q.path[t]!==prev)collapsed.push(q.path[t]);prev=q.path[t];}assert.deepEqual(collapsed,q.ids);
   const states=[r.blankId];for(const id of q.ids)states.push(id,r.blankId);let dp=Array(states.length).fill(-Infinity);dp[0]=r.logProbs[0][r.blankId];if(states.length>1)dp[1]=r.logProbs[0][states[1]];
   for(let t=1;t<T;t++){const next=Array(states.length).fill(-Infinity);for(let s=0;s<states.length;s++){let best=dp[s];if(s)best=Math.max(best,dp[s-1]);if(s>1&&states[s]!==r.blankId&&states[s]!==states[s-2])best=Math.max(best,dp[s-2]);next[s]=best+r.logProbs[t][states[s]];}dp=next;}
   const optimum=Math.max(dp.at(-1),dp.at(-2));const observed=q.frameLogScores.reduce((x,y)=>x+y,0);const absSum=q.frameLogScores.reduce((x,y)=>x+Math.abs(y),0);const roundoff=2*T*2**-23*absSum;assert(Math.abs(optimum-observed)<=roundoff,`optimal path ${provider}/${c.id}/${q.text}: ${optimum} ${observed} ${roundoff}`);
   assert.equal(q.spans.length,q.ids.length);for(let i=0;i<q.spans.length;i++){const s=q.spans[i];assert.equal(s.token,q.ids[i]);assert.equal(s.startSeconds,s.startFrame*r.frameDuration);assert.equal(s.endSeconds,s.endFrame*r.frameDuration);let sum=0;for(let t=s.startFrame;t<s.endFrame;t++){assert.equal(q.path[t],s.token);sum+=Math.exp(q.frameLogScores[t]);}assert(Math.abs(s.nativeMeanTokenProbability-sum/(s.endFrame-s.startFrame))<=2**-22);if(s.endFrame*frameSampleNumerator>r.sourceFrames*frameSampleDenominator)outOfSupport.push({provider,id:c.id,text:q.text,end:s.endSeconds,physicalEnd:r.audioSeconds});else if(s.endSeconds>r.audioSeconds)clockRepresentationRoundoff.push({provider,id:c.id,nativeEnd:s.endSeconds,physicalEnd:r.audioSeconds,exactFrameSupport:'within_physical_PCM'});}candidates++;
  }cases++;
 }
}
assert.equal(cases,selected?2:14);if(!selected)assert.equal(candidates,46);if(!selected||selected==='fortunate-truncated')assert(outOfSupport.some(x=>x.provider==='nemo-ctc110'&&x.id==='fortunate-truncated'));
console.log(JSON.stringify({status:'retained-operands-and-arithmetic-replay-pass',cases,candidates,sourceFiles:bundle.files.length,outOfSupport,clockRepresentationRoundoff,productionProviderInstalled:false},null,2));

await import('./replay-correspondence.mjs');
