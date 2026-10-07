import {Models} from '/Users/server/dev/yap-video-editing/packages/core/src/models.ts';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const b='/tmp/yap-editing-speaker-replication';const d=b+'/nemotron-preparation';await mkdir(d,{recursive:true});
const info=JSON.parse(await readFile(b+'/nemotron3-metadata/model.json','utf8'));
const tree=JSON.parse(await readFile(b+'/nemotron3-metadata/tree.json','utf8'));const entry=tree.find((x:any)=>x.path==='Nemotron-3-Diarization.nemo');
const sha=(x:Buffer)=>createHash('sha256').update(x).digest('hex');
const manifest={name:'nemotron3-checkpoint-research',purpose:'speaker',platform:{system:'darwin',architecture:'arm64'},repo:info.id,revision:info.sha,folderName:'checkpoint',engine:{runtime:'NeMo',runtimeVersion:'3.0.0',runtimeRevision:'not-prepared',decoder:'nemotron3-research-only'},files:[{path:entry.path,bytes:entry.size,sha256:entry.lfs.oid}]};
const protocol={scope:'Checkpoint-only preparation with existing Core Models; no production runtime/profile readiness claim',manifest,license:'OpenMDW1.1',licenseURL:'https://openmdw.ai/license/1-1/',cardSha256:sha(await readFile(b+'/nemotron3-metadata/model-card.md')),qualityGates:{DERMaximum:.2,identityConfusionMaximum:.05,overlapRecallMinimum:.8,RSSBytesMaximum:4294967296,inferenceWallAudioRatioMaximum:2},candidateRecipe:{chunk_len:340,chunk_right_context:40,fifo_len:40,spkcache_update_period:300,spkcache_len:264},sourceRoles:{calibration:'bspxd30 and independent100s return/overlap assembly',heldOut:'aiqwk30 before longer4speaker control'},originalBoundary:'Original pinned2.7.3 runtime, checkpoint and matched15fields retained exactly; this is a distinct provider'};
if(JSON.stringify(JSON.parse(await readFile(d+'/protocol.json','utf8')))!==JSON.stringify(protocol))throw new Error('Frozen protocol changed');
await mkdir(b+'/nemotron-model-library',{mode:0o700});
const models=new Models(b+'/nemotron-model-library',globalThis.fetch,[manifest as any]);
const start=performance.now();const ticker=setInterval(async()=>console.log(JSON.stringify({elapsedSeconds:(performance.now()-start)/1000,status:await models.status(manifest.name)})),10000);
try{await models.prepare(manifest.name,AbortSignal.timeout(10*60*1000));await writeFile(d+'/receipt.json',JSON.stringify({status:await models.status(manifest.name),modelPath:b+'/nemotron-model-library/models/'+manifest.name+'/'+info.sha+'/checkpoint/'+entry.path,seconds:(performance.now()-start)/1000},null,2),{flag:'wx'});}finally{clearInterval(ticker);await models.settled();}
