import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {Models} from '/Users/server/dev/yap-video-editing/packages/core/src/models.ts';
const b='/tmp/yap-editing-speaker-replication';const d=b+'/fluidaudio-feasibility';const manifest=JSON.parse(await readFile(d+'/manifest.json','utf8'));const receipt=JSON.parse(await readFile(d+'/preparation.json','utf8'));const models=new Models(b+'/fluidaudio-model-library',globalThis.fetch,[manifest]);
const status=await models.status(manifest.name);assert.equal(status.state,'ready');
const files=[];
for(const f of manifest.files){const bytes=await readFile(join(receipt.modelDirectory,f.path));const sha256=createHash('sha256').update(bytes).digest('hex');assert.equal(bytes.length,f.bytes);assert.equal(sha256,f.sha256);files.push({path:f.path,bytes:bytes.length,sha256});}
const transport=JSON.parse(await readFile(d+'/transport-r3.json','utf8'));assert.equal(transport.result.ok,true);assert.equal(transport.result.data.offlineModelsLoaded,true);
await writeFile(d+'/readiness.json',JSON.stringify({state:'ready',scope:'Exact five-artifact native model closure with retained attribution; all four CoreML models and PLDA params loaded offline, complete closure rehashed after inference. Not production registration or arbitrary-duration quality.',networkDenied:true,modelsOwnerStatus:status,files,offlineModelLoadSeconds:transport.result.data.modelLoadSeconds,qualityReady:false,rawModelLogitsRetained:false},null,2),{flag:'wx'});await models.settled();console.log(JSON.stringify({state:'ready',verifiedFiles:files.length,qualityReady:false}));
