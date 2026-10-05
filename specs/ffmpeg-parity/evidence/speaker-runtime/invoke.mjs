import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { Models } from "../../../../packages/core/src/models.ts";
import { jsonWorker } from "../../../../apps/service/src/worker.ts";
const evidence = new URL("./", import.meta.url);
const protocol = JSON.parse(await readFile(new URL("frozen-protocol.json", evidence), "utf8"));
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
for (const input of protocol.boundFiles) assert.equal(sha(await readFile(new URL(input.path, evidence))), input.sha256);
const out = protocol.execution.out;
await mkdir(out, { mode: 0o700 });
const entries = JSON.parse(await readFile(protocol.execution.manifest, "utf8"));
const artifact = { entries, digest: sha(JSON.stringify(entries)), python: "python/bin/python", entry: "execution/launch.py" };
await writeFile(join(out, "runtime-artifact.json"), JSON.stringify(artifact, null, 2), {flag:"wx"});
const files = protocol.model.files;
const manifest = { name:"speaker-runtime-control", purpose:"speaker", platform:{system:"darwin",architecture:"arm64"},
 repo:protocol.model.repository, revision:protocol.model.revision, folderName:"original-model",
 engine:{runtime:"NeMo",runtimeVersion:"2.7.3",runtimeRevision:artifact.digest,decoder:"sortformer-original30s"},runtimeArtifact:artifact,files};
await writeFile(join(out,"private-manifest.json"),JSON.stringify(manifest,null,2),{flag:"wx"});
const home=join(out,"scratch-library");await mkdir(home,{mode:0o700});
const models=new Models(home,async()=>{throw new Error("Network acquisition is forbidden")},[manifest]);
let progress=0;
const ticker=setInterval(()=>{console.log(JSON.stringify({phase:"preparing",elapsedSeconds:++progress*10}));},10000);
const started=performance.now();
try{
 await models.prepare(manifest.name,new AbortController().signal,{runtimeSource:protocol.execution.runtimeSource,modelSource:protocol.model.source});
 const prepared=await models.status(manifest.name);
 await writeFile(join(out,"preparation-result.json"),JSON.stringify(prepared,null,2),{flag:"wx"});
 assert.equal(prepared.state,"ready");
}finally{clearInterval(ticker);await models.settled();}
const preparation=await models.runtime(manifest.name,"speaker");
await writeFile(join(out,"prepared-runtime.json"),JSON.stringify(preparation,null,2),{flag:"wx"});
const restart=new Models(home,async()=>{throw new Error("Network acquisition is forbidden")},[manifest]);
assert.equal((await restart.status(manifest.name)).state,"ready");
await writeFile(join(out,"offline-restart.json"),JSON.stringify({state:"ready",preparationSeconds:(performance.now()-started)/1000}),{flag:"wx"});
const source=await readFile(protocol.input.path);assert.equal(sha(source),protocol.input.sha256);
const params={model:join(preparation.model,protocol.model.checkpoint),pcm:protocol.input.path,pcmSha256:protocol.input.sha256,frames:480000,sampleRate:16000,output:join(out,"bspxd.json")};
await writeFile(join(out,"request.json"),JSON.stringify({operation:"speaker.observe",params},null,2),{flag:"wx"});
const profile=protocol.execution.sandboxProfile;
const worker=jsonWorker({executable:"/usr/bin/sandbox-exec",args:["-p",profile,preparation.python,"-I","-B",preparation.entry],
 environment:{...process.env,HF_HOME:preparation.cache,HF_HUB_OFFLINE:"1",TRANSFORMERS_OFFLINE:"1",HF_HUB_DISABLE_IMPLICIT_TOKEN:"1",
 MPLCONFIGDIR:join(out,"owned-cache/mpl"),XDG_CACHE_HOME:join(out,"owned-cache/xdg"),PYTHONDONTWRITEBYTECODE:"1",TOKENIZERS_PARALLELISM:"false"}},120000);
console.log("START original bspxd via prepared relocated jsonWorker");
const inferenceStart=performance.now(),result=await worker("speaker.observe",params,{timeoutMs:120000});
await writeFile(join(out,"response-unverified.json"),JSON.stringify({verified:false,result,wallSeconds:(performance.now()-inferenceStart)/1000}),{flag:"wx"});
assert.equal(result.ok,true,JSON.stringify(result));
const original=JSON.parse(await readFile(new URL("../speaker-original/bspxd.json",evidence),"utf8"));
const raw=JSON.parse(await readFile(params.output,"utf8"));
for(const field of protocol.comparison.exactFields)assert.deepEqual(raw[field],original[field],field);
assert(raw.inferenceSeconds<=60 && raw.peakProcessRSSBytes<=4294967296);
await writeFile(join(out,"comparison.json"),JSON.stringify({passed:true,scope:"One exact original30s bspxd transported through existing Models/runtime/jsonWorker; no public speaker registration or quality widening",exactFields:protocol.comparison.exactFields,inferenceSeconds:raw.inferenceSeconds,peakProcessRSSBytes:raw.peakProcessRSSBytes,runtimeDigest:artifact.digest},null,2),{flag:"wx"});
console.log("PASS exact original bspxd runtime seam");
