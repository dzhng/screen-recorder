# Retained source scene evidence

The existing scene generation owner now retains presentation-based asset chunks
with exact physical clocks, explicit unavailable observations and acquisition
support identity. Recording/package chunks keep their nearest-sample policy and
portable representation. A typed asset page cannot pass through the recording
page view.

Boundary reads seek an index of actual source timestamps, rather than request
chunk starts. Rounded microseconds identify candidates; exact rational timestamps
settle half-open range membership. A page may contain no accepted boundaries and
still carry a continuation after rejected candidates. The continuation seeks both
time and ordinal directly, so collisions and long traversals remain bounded.

Catalog 9 stores the new boundary index and bounded chunk-overlap state. Completed
generations alone are readable; append validation and boundary publication share
one transaction. Reclamation removes chunks and boundary rows in bounded batches.
No source preparation job, public scene event route, screenshot index or live
CLI/MCP scene readiness is claimed by this storage checkpoint.

## Verification

- Focused source sampler/store/ownership tests: 23 passed on resume.
- Full core preservation: 526 passed, one skipped. Tests use controlled source
  observations and real SQLite/filesystem storage, not captured media.
- A rounded-clock mutation fails range-membership assertions; restored exact
  clocks pass.
- Independent review found continuation scans starting at the original window.
  The regression fails before the fix and passes after it; it reads SQLite's
  executed seek key registers, beyond checking returned row count or LIMIT.
- Final independent review found no actionable regressions; its sandboxed full
  suite had localhost-listener permission failures, while the unrestricted full
  preservation run passed. See [review](review.txt) and [core result](core-summary.txt).
- Source retention covers reopening, gap/stillness overlap identity, transactional
  rejection, empty versus missing generations, colliding rounded timestamps and
  late indexed retrieval/reclamation. Existing recording future-nearest boundary
  and portable evidence tests remain in the full preservation run.

The executable contracts live in
[retention tests](../../../../../packages/core/src/source-scene-retention.test.ts)
and [recording preservation](../../../../../packages/core/src/scene-evidence.test.ts).
