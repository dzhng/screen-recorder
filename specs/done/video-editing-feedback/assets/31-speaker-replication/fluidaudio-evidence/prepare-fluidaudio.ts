import {Models} from '/Users/server/dev/yap-video-editing/packages/core/src/models.ts';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const b='/tmp/yap-editing-speaker-replication';const d=b+'/fluidaudio-feasibility';const manifest=JSON.parse(await readFile(b+'/fluidaudio-feasibility/manifest.json','utf8'));
await mkdir(b+'/fluidaudio-model-library',{recursive:true,mode:0o700});
const models=new Models(b+'/fluidaudio-model-library',globalThis.fetch,[manifest]);
const start=performance.now();const timer=setInterval(async()=>console.log(JSON.stringify({elapsedSeconds:(performance.now()-start)/1000,status:await models.status(manifest.name)})),5000);
try{
 await models.prepare(manifest.name,AbortSignal.timeout(180000),{modelSource:JSON.parse(await readFile(b+'/fluidaudio-feasibility/preparation-folder-refused.json','utf8')).modelDirectory});
 await writeFile(b+'/fluidaudio-feasibility/preparation.json',JSON.stringify({status:await models.status(manifest.name),modelDirectory:b+'/fluidaudio-model-library/models/'+manifest.name+'/'+manifest.revision+'/'+manifest.folderName,seconds:(performance.now()-start)/1000,claim:'Pinned byte closure prepared; offline model load pending'},null,2),{flag:'w'});
}finally{clearInterval(timer);await models.settled();}
