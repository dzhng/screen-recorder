import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, cp, mkdir, chmod} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';import {join} from 'node:path';
import {RevisionStore} from '/Users/david/.codex/worktrees/project-still-composition/screen-recorder/packages/core/dist/library.js';
import {JourneyService,poll} from '/Users/david/.codex/worktrees/project-still-composition/screen-recorder/packages/test-harness/editing/source-evidence-fixture.mjs';
const out=await mkdtemp('/tmp/capture-source-retry-public-');console.log(out);const report={trace:[],results:[],boundary:'Actual prerecorded source installed by existing RevisionStore fixture; real service/native job and CLI retry. No physical capture.'};
const donor='/tmp/capture-real-controller-5egDNR/take';
const digest=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
for(const mode of ['journal','canonical','corrupt']){
 const home=join(out,mode);await mkdir(home);const header=JSON.parse((await readFile(join(donor,'capture.journal.jsonl'),'utf8')).split('\n')[0]).data;let ids=0;
 const store=new RevisionStore(join(home,'library.sqlite'),{now:()=>new Date().toISOString(),newId:()=>++ids===2?header.sessionID:randomUUID()});const recording=store.allocate().recording;
 store.ingestLifecycle(recording.recordingId,{sourceId:recording.sourceId,sequence:1,state:'finalizing'});
 store.ingestLifecycle(recording.recordingId,{sourceId:recording.sourceId,sequence:2,state:'complete',sourceDurationUs:2500000});store.close();
 const source=join(home,'recordings',recording.recordingId,'source');await cp(donor,source,{recursive:true});
 const members=['capture.journal.jsonl','narration.mov','narration.publication.json'];const before=Object.fromEntries(await Promise.all(members.map(async n=>[n,await digest(join(source,n))])));
 const target=join(source,mode==='journal'?'capture.journal.jsonl':'narration.mov');
 if(mode==='corrupt')await writeFile(target,'corrupted canonical');else await chmod(target,0);
 const service=new JourneyService(home,report,join(out,'reads.jsonl'),new URL('file:///tmp/capture-full-service.mjs'));
 try{await service.start();const failed=await poll(()=>service.call('processing.status',{recordingId:recording.recordingId,artifact:'source'}),v=>v.state==='failed','failed source');
 assert.equal(failed.retryable,mode!=='corrupt',JSON.stringify(failed));
 if(mode==='corrupt'){report.results.push({mode,failed});continue;}
 await chmod(target,0o600);const retry=await service.call('processing.retry',{recordingId:recording.recordingId,artifact:'source'});assert.equal(retry.jobId,failed.jobId);
 const ready=await poll(()=>service.call('processing.status',{recordingId:recording.recordingId,artifact:'source'}),v=>v.state==='ready','ready source');
 const after=Object.fromEntries(await Promise.all(members.map(async n=>[n,await digest(join(source,n))])));assert.deepEqual(after,before);assert.equal(ready.sourceId,recording.sourceId);assert.equal(ready.jobId,failed.jobId);
 report.results.push({mode,recordingId:recording.recordingId,failed,retry,ready,before,after});
 }finally{if(mode!=='corrupt')await chmod(target,0o600);await service.stop();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
}
report.passed=true;await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
