import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
const[worker,audio,source,destination]=process.argv.slice(2),out=resolve(destination);
mkdirSync(out,{recursive:true});assert.deepEqual(readdirSync(out),[]);
const sha=b=>createHash('sha256').update(b).digest('hex');
const before=[source,audio].map(p=>sha(readFileSync(p))),exchanges=[];
const run=(command,args,input)=>{const r=spawnSync(command,args,{input,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});assert.ifError(r.error);assert.equal(r.status,0,r.stderr);return r.stdout;};
const call=(operation,params)=>{const request={id:String(exchanges.length),operation,params};const response=JSON.parse(run(worker,[],JSON.stringify(request)+'\n'));exchanges.push({request,response});assert.equal(response.ok,true,JSON.stringify(response));return response.data;};
const range={startUs:0,endUs:2000000},plan=[{source:range,playback:range}];
try{
  for(const[stem,tracks]of[['mux',[{role:'narration',source:audio,sourceOffsetUs:0,available:[range]}]],['picture',[]]]){
    call('media.renderMovie',{source,output:join(out,stem+'.mp4'),plan,tracks});
    run('ffmpeg',['-v','error','-i',join(out,stem+'.mp4'),'-map','0:v','-f','rawvideo','-pix_fmt','rgb24','-fps_mode','passthrough',join(out,stem+'.rgb')]);
  }
  assert.deepEqual(readFileSync(join(out,'mux.rgb')),readFileSync(join(out,'picture.rgb')));
  const probe=JSON.parse(run('ffprobe',['-v','error','-show_format','-show_streams','-of','json',join(out,'mux.mp4')]));
  assert.equal(probe.streams.length,2);const sound=probe.streams.find(s=>s.codec_type==='audio');
  assert.equal(sound.codec_name,'aac');assert.equal(Number(sound.sample_rate),48000);assert.equal(sound.channels,2);assert.equal(Number(sound.start_time),0);
  assert.ok(Math.abs(Number(probe.format.duration)-2)<.000022);
  run('ffmpeg',['-v','error','-i',join(out,'mux.mp4'),'-map','0:a','-f','f32le',join(out,'mux.f32')]);
  const decoded=readFileSync(join(out,'mux.f32')),original=readFileSync(audio);
  assert.ok(decoded.length/8>=96000&&decoded.length/8<97024);
  let error=0;for(let i=0;i<96000*2;i++)error+=(decoded.readFloatLE(i*4)-original.readFloatLE(44+i*4))**2;
  const rms=Math.sqrt(error/(96000*2));assert.ok(rms<.01);
  assert.deepEqual([source,audio].map(p=>sha(readFileSync(p))),before);
  writeFileSync(join(out,'report.json'),JSON.stringify({passed:true,exchanges,probe,rms,sourceHashes:before,rgbSha256:sha(readFileSync(join(out,'mux.rgb')))},null,2)+'\n');
}finally{writeFileSync(join(out,'exchanges.json'),JSON.stringify(exchanges,null,2)+'\n');}
console.log('PASS actual movie AAC mux preserves source bytes, decoded pictures, clock, stereo and PCM alignment');
