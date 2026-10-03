import { JourneyService, hash, poll } from '/Users/david/.codex/worktrees/acquisition-picture-journey/screen-recorder/packages/test-harness/editing/source-evidence-fixture.mjs';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
const out='/tmp/screenrec-fractional-clock';
const report={trace:[],nativeSha256:hash(await readFile(process.env.SCREENREC_NATIVE)),sourceSha256:hash(await readFile(out+'/impulses.caf')),complete:false};
const home=await mkdtemp('/tmp/sr-fractional-');const service=new JourneyService(home,report);const call=service.call.bind(service);
try {
 await service.start();
 const pending=await call('asset.import',{path:out+'/impulses.caf',requestId:'fractional-impulses'});
 const job=await poll(()=>call('job.get',{jobId:pending.jobId}),v=>v.state==='ready','import');
 const asset=await call('asset.get',{assetId:job.result.assetId},{transport:'mcp'});report.asset=asset;
 const made=await call('project.create',{requestId:'fractional',canvas:{width:320,height:180,fps:{numerator:30,denominator:1},background:'#000000ff'}});
 const projectId=made.project.projectId;
 const edited=await call('edit.apply',{projectId,expectedRevisionId:made.revision.id,requestId:'place',operations:[{operation:'track.add',label:'audio',track:{kind:'audio',order:0}},{operation:'place',clip:{trackId:{label:'audio'},assetId:asset.id,streamId:asset.streams[0].id,source:{kind:'range',range:{startUs:0,endUs:8500000}},placement:{kind:'project',range:{startUs:0,endUs:8500000}}}}]});
 report.project={projectId,revisionId:edited.revision.id};report.outputs={};
 for(const [name,range] of [['full',{startUs:0,endUs:8500000}],['late',{startUs:7800011,endUs:8200037}]]){
  const params={...report.project,range};
  await poll(()=>call('audio.get',params,{transport:'mcp'}),v=>v.state==='ready',name);
  report.outputs[name]=await call('audio.get',params,{output:out+'/'+name+'.wav'});
 }
 report.complete=true;
} finally {
 try {await writeFile(out+'/public.json',JSON.stringify(report,null,2));}
 finally {try {await service.stop();}finally{await rm(home,{recursive:true,force:true});}}
}
