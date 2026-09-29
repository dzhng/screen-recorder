import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,cp,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {RevisionStore} from '/Users/david/.codex/worktrees/project-still-composition/screen-recorder/packages/core/dist/library.js';
import {JourneyService} from '/Users/david/.codex/worktrees/project-still-composition/screen-recorder/packages/test-harness/editing/source-evidence-fixture.mjs';
const out=await mkdtemp('/tmp/capture-recovery-long-'),home=join(out,'home');await mkdir(home);
const donor='/tmp/probe-consumer-red/source';
const header=JSON.parse((await readFile(join(donor,'capture.journal.jsonl'),'utf8')).split('\n')[0]).data;
let ids=0;const store=new RevisionStore(join(home,'library.sqlite'),{now:()=>new Date().toISOString(),newId:()=>++ids===2?header.sessionID:randomUUID()});const take=store.allocate().recording;store.ingestLifecycle(take.recordingId,{sourceId:take.sourceId,sequence:1,state:'recording'});store.close();await cp(donor,join(home,'recordings',take.recordingId,'source'),{recursive:true});
const report={trace:[],boundary:'Full service with authoritative idle native-control fixture; actual media.recover worker and banked100k canonical media. No live capture.'};const service=new JourneyService(home,report,join(out,'reads.jsonl'),new URL('file:///tmp/capture-recovery-service.mjs'));console.log(out);
try {const start=performance.now();await service.start();const ackStart=performance.now();report.ack=await service.call('capture.stop',{recordingId:take.recordingId});report.ackMs=performance.now()-ackStart;assert.equal(report.ack.state,'finalizing');assert(report.ackMs<10000);let observedBeyond=false;
while(performance.now()-start<600000){const statusStart=performance.now();const status=await service.call('capture.status',{});assert(performance.now()-statusStart<10000);const current=await service.call('recording.get',{recordingId:take.recordingId});if(current.state!=='finalizing'){report.terminal=current;break;}assert.equal(current.finalizationError,null);if(performance.now()-start>30000)observedBeyond=true;await new Promise(r=>setTimeout(r,1000));}
report.elapsedMs=performance.now()-start;assert(observedBeyond);assert.equal(report.terminal?.state,'interrupted');assert(report.terminal.sourceDurationUs>0);report.passed=true;
} finally {await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));await writeFile(join(out,'service.log'),service.logs.join(''));await service.stop();}
