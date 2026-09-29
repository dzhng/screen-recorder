import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, cp, mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {RevisionStore} from '/Users/david/.codex/worktrees/project-still-composition/screen-recorder/packages/core/dist/library.js';
import {JourneyService,poll} from '/Users/david/.codex/worktrees/project-still-composition/screen-recorder/packages/test-harness/editing/source-evidence-fixture.mjs';
const out=await mkdtemp('/tmp/capture-clean-recording-'),home=join(out,'home');await mkdir(home);
const donor='/tmp/capture-packed-native-parity-9/publication-conflict';
const captured=JSON.parse(await readFile(join(donor,'capture-result.json'),'utf8'));
const header=JSON.parse((await readFile(join(donor,'capture.journal.jsonl'),'utf8')).split('\n')[0]).data;
let ids=0;const store=new RevisionStore(join(home,'library.sqlite'),{now:()=>new Date().toISOString(),newId:()=>++ids===2?header.sessionID:randomUUID()});
const recording=store.allocate().recording;
store.ingestLifecycle(recording.recordingId,{sourceId:recording.sourceId,sequence:1,state:'interrupted',reason:captured.failure.code,sourceDurationUs:captured.durationUs});store.close();
await cp(donor,join(home,'recordings',recording.recordingId,'source'),{recursive:true});
const report={trace:[],boundary:'Real native capture result and files installed via existing library fixture owner; public CLI/MCP frame consumer. No public capture or hardware acquisition.'};
const service=new JourneyService(home,report,join(out,'reads.jsonl'),new URL('file:///tmp/capture-full-service.mjs'));
try {await service.start();const frame=await poll(()=>service.call('frame.get',{recordingId:recording.recordingId,atUs:500000,clean:true},{output:join(out,'clean.png')}),v=>v.state==='ready','clean frame');assert((await readFile(join(out,'clean.png'))).length>100);report.frame=frame;report.recording=await service.call('recording.get',{recordingId:recording.recordingId},{transport:'mcp'});console.log(out);}finally{await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));await service.stop();}
