import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const b='/tmp/yap-editing-alignment-replication',dir=b+'/reference-receipts',owner='/Users/server/dev/yap-video-editing/packages/core/src/word-kind.ts';
const ts=await readFile(b+'/correspondence-reference.ts','utf8'),fold=await readFile(owner,'utf8');
await writeFile(dir+'/word-kind.ts',fold,{flag:'wx'});
const t=new Bun.Transpiler({loader:'ts',target:'node'});
await writeFile(dir+'/word-kind.mjs',t.transformSync(fold),{flag:'wx'});
await writeFile(dir+'/correspondence-reference.mjs',t.transformSync(ts).replace(owner,'./word-kind.mjs'),{flag:'wx'});
await writeFile(dir+'/replay-transform.json',JSON.stringify({tool:'Bun.Transpiler',version:Bun.version,loader:'ts',target:'node',sourceSha256:createHash('sha256').update(ts).digest('hex'),ownerSha256:createHash('sha256').update(fold).digest('hex'),onlyRelocation:'Emitted import from absolute core owner becomes local verbatim-transpiled word-kind.mjs; no arithmetic/policy changes'},null,2),{flag:'wx'});
