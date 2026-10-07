import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {correspond} from './reference-receipts/correspondence-reference.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),manifest=JSON.parse(await readFile(path.join(root,'bundle.json')));
const get=async name=>{const row=manifest.files.find(r=>r.source===name);assert(row);const stored=await readFile(path.join(root,row.path));return JSON.parse((row.compression?gunzipSync(stored):stored).toString());};
const p=await get('nemo-ctc110/protocol-r2.json');let operands=0,matched=0,unknown=0,unmatched=0,observedExtra=0;
const selected=process.argv[2]==='--case'?process.argv[3]:undefined;
for(const c of p.cases.filter(c=>!selected||c.id===selected)){const r=await get(`nemo-ctc110-correspondence/${c.id}.json`),a=await get(`nemo-ctc110-alignment/${c.id}.json`);assert.equal(r.greedyText,a.greedyText);for(const q of r.candidates){const got=correspond(q.text.split(/\s+/).filter(Boolean),q.observed.map(w=>w.text));assert.equal(q.optimum,got.optimum);assert.deepEqual(q.requested.map(({index,text,folded,status,observedIndices,omissionPossible})=>({index,text,folded,status,observedIndices,omissionPossible})),got.requested);assert.deepEqual(q.observed.map(({index,text,folded,status,suppliedIndices,extraPossible})=>({index,text,folded,status,suppliedIndices,extraPossible})),got.observed);
 for(const w of q.requested){assert.equal(w.confidence,null);assert.equal(w.estimatedBounds.startSeconds,w.estimatedBounds.startFrame*.08);assert.equal(w.estimatedBounds.endSeconds,w.estimatedBounds.endFrame*.08);assert.equal(w.physicalAdmission,w.estimatedBounds.endFrame*1280>c.frames?'refused_unowned_support':'within_source_support');for(const t of w.tokens){assert.equal(t.correspondence,w.status);assert.equal(t.physicalAdmission,t.endFrame*1280>c.frames?'refused_unowned_support':'within_source_support');}if(w.status==='matched')matched++;else if(w.status==='unknown')unknown++;else unmatched++;}
 observedExtra+=q.observed.filter(w=>w.status==='observed_extra').length;assert.equal(q.partialLexicalInterpretation,c.id==='false-start'||c.id==='fortunate-truncated'?'unknown':'not_inferred');operands++;}}
const repeat=await get('nemo-ctc110-correspondence/constructed-repeats.json');assert.deepEqual(repeat.candidates.map(q=>q.requested.map(w=>w.status)),[['matched','matched','matched'],['matched','unmatched','matched'],['matched','matched'],['matched','unmatched','matched'],['matched','matched','unknown','unknown']]);
if(!selected){assert.equal(operands,23);assert(matched>0&&unknown>0&&unmatched>0&&observedExtra>0);}
console.log(JSON.stringify({status:'cached-provider-correspondence-replay-pass',operands,matched,unknown,unmatched,observedExtra,inferenceRuns:0,lexicalGroundTruthClaim:false}));
