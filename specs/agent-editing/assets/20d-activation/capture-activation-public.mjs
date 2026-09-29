import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {JourneyService,poll} from '/Users/david/.codex/worktrees/project-still-composition/screen-recorder/packages/test-harness/editing/source-evidence-fixture.mjs';
const out=await mkdtemp('/tmp/capture-activation-public-');
const report={trace:[],checks:{}};
const service=new JourneyService(join(out,'home'),report,join(out,'reads.jsonl'),new URL('file:///Users/david/.codex/worktrees/project-still-composition/screen-recorder/packages/test-harness/editing/capture-evidence-service.mjs'));
try {
await service.start();
const started=await service.call('acquisition.import',{requestId:'actual-capture',path:'/tmp/capture-packed-native-parity-9/normal'});
const job=await poll(()=>service.call('job.get',{jobId:started.jobId},{transport:'mcp'}),v=>v.state==='ready','actual import');
const acquisition=await service.call('acquisition.get',{acquisitionId:job.target.acquisitionId});
assert.equal(acquisition.evidence.receipt.header.schemaVersion,2);
assert(acquisition.bindings.some(b=>b.sourceRoles.includes('narration')));
assert(acquisition.bindings.some(b=>b.sourceRoles.includes('system')));
await writeFile(join(out,'acquisition.json'),JSON.stringify(acquisition,null,2));
report.checks.actualWriterAdmitted=true;
const refused=await service.call('acquisition.import',{requestId:'conflict-capture',path:'/tmp/capture-packed-native-parity-9/publication-conflict'});
const failed=await poll(()=>service.call('job.get',{jobId:refused.jobId}),v=>v.state==='failed','conflict refusal');
report.checks.conflictRefused=failed;
console.log(out);
} finally { await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)); await service.stop(); }
