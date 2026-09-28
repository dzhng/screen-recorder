# Combined pointer, image and acquisition verification

The frozen native worker combines prepared pointer execution, timeless source
images and acquisition-anchor transparency. The [verification manifest](verification.json)
pins the executable and uncompressed report hashes; `gzip -dc` reads each complete
retained report. These are integration checks, not broader quality acceptance.

The prepared-pointer matrix retains its original failing legacy exact-pixel and
encoded magenta-centroid gates. Geometry, held-frame reuse, inactive execution and
cache regeneration checks pass; full colored-trail acceptance remains open.
Source-image and acquired-gap public journeys pass against the same worker, as
does the complete layer/tap native matrix including expected transparent movie
refusals. No public pointer binding is implied.

The integrated core suite passes 627 tests with one existing skip. Focused pointer,
history and job tests pass 97 tests. Targeted CLI/service builds pass. Original
logs are retained with terminal trailing whitespace removed.

Reproduction uses the owning `pointer-native.mjs`, `source-image-evidence.mjs`,
`acquisition-picture-evidence.mjs` and `layers-native.mjs` harnesses under
`packages/test-harness/editing`, with `SCREENREC_NATIVE` selecting the pinned worker.
Consult each harness for its output-directory argument; all use isolated state.

Review: no new production API, dependency or ownership decision is introduced by
this evidence pass. Shape and documentation review retain one evidence home and
keep the known red quality gates separate from passing execution checks.
