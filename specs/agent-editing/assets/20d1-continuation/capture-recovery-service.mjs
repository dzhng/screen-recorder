import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
const child=spawn(process.execPath,['/Users/david/.codex/worktrees/project-still-composition/screen-recorder/apps/service/dist/main.js'],{env:{...process.env,SCREENREC_HOME:process.argv[2]},stdio:['pipe','pipe','pipe']});
child.stderr.pipe(process.stderr);
createInterface({input:child.stdout}).on('line',line=>{const m=JSON.parse(line);if(m.event==='started')process.send({socketPath:m.socketPath});else if(m.event==='call'){const data={state:'idle',recordingId:null,sourceId:null,elapsedUs:null,selection:null,permissions:{screen:true,microphone:'authorized'}};const answer=m.request.operation==='capture.status'?{ok:true,data}:{ok:false,error:{code:'INVALID_STATE',message:'No physical native session in fixture',retryable:false,details:{}}};child.stdin.write(JSON.stringify({event:'result',response:{id:m.request.id,...answer}})+'\n');}});
const stop=()=>child.kill('SIGTERM');process.on('message',m=>{if(m==='close')stop()});process.on('disconnect',stop);child.on('exit',()=>{if(process.connected)process.disconnect()});
