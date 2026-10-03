import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {JourneyService,hash} from '/Users/david/.codex/worktrees/acquisition-picture-journey/screen-recorder/packages/test-harness/editing/source-evidence-fixture.mjs';
const phase=process.argv[2],out='/tmp/screenrec-fractional-clock',home=out+'/cache-home';
assert(['seed','verify'].includes(phase));
if(phase==='seed')await mkdir(home);
const report={phase,trace:[],checks:{},nativeSha256:hash(await readFile(process.env.SCREENREC_NATIVE))};
const service=new JourneyService(home,report),call=service.call.bind(service);
async function terminal(operation,params){const until=performance.now()+120000;for(;;){const r=await call(operation,params,{transport:'mcp'});if(['ready','failed','canceled'].includes(r.state))return r;assert(performance.now()<until);await delay(100);}}
try{
 await service.start();
 let state;
 if(phase==='seed'){
  const imported=await call('asset.import',{requestId:'source',path:out+'/impulses.caf'});
  const job=await terminal('job.get',{jobId:imported.jobId});assert.equal(job.state,'ready');
  const asset=await call('asset.get',{assetId:job.result.assetId});
  const made=await call('project.create',{requestId:'seed',canvas:{width:16,height:16,fps:{numerator:30,denominator:1},background:'#000000ff'}});
  const projectId=made.project.projectId;
  const edited=await call('edit.apply',{projectId,expectedRevisionId:made.revision.id,requestId:'place',operations:[{operation:'track.add',label:'a',track:{kind:'audio',order:0}},{operation:'place',clip:{trackId:{label:'a'},assetId:asset.id,streamId:asset.streams[0].id,source:{kind:'range',range:{startUs:0,endUs:8500000}},placement:{kind:'project',range:{startUs:0,endUs:8500000}}}}]});
  state={projectId,revisionId:edited.revision.id,asset,requests:{}};
  for(const operation of ['audio.get','preview.get','audio.prepare']){
   const params={projectId,revisionId:edited.revision.id,...(operation==='preview.get'?{range:{startUs:0,endUs:100000}}:{})};
   const ready=await terminal(operation,params);assert.equal(ready.state,'ready');assert(ready.published);
   state.requests[operation]={params,ready};
   if(operation!=='audio.prepare')await call(operation,params,{output:out+'/seed-'+(operation==='audio.get'?'audio.wav':'preview.mp4')});
  }
  await writeFile(out+'/cache-seed.json',JSON.stringify(state,null,2));
 }else{
  state=JSON.parse(await readFile(out+'/cache-seed.json','utf8'));
  const asset=await call('asset.get',{assetId:state.asset.id});assert.equal(asset.streams[0].sampleRate,44100.5);
  for(const [operation,{params,ready}]of Object.entries(state.requests)){
   const failed=await terminal(operation,params);report.checks[operation]={old:ready,new:failed};
   assert.equal(failed.state,'failed');assert.match(failed.reason,/integral native sample rate/);assert.equal(failed.published,null);assert.notEqual(failed.jobId,ready.jobId);
  }
 }
 report.passed=true;
}finally{try{await writeFile(out+'/cache-'+phase+'-report.json',JSON.stringify(report,null,2));}finally{await service.stop();}}
if(phase==='verify')await rm(home,{recursive:true,force:true});
