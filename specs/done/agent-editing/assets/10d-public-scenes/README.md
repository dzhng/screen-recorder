# Public source and project scene events

The actual CLI/MCP journey imports an authored black/white movie with a nonzero
container origin and physical empty edit. Expected changes come from authored
frame colors and timing, independently of the scene detector. Exact sample start
and end clocks are pinned to the authored origin. A synthetic captured-source
journal adds a pause tied with a scene and a capture-end interruption; the complete
mixed order is authored independently before projection into repeated and retimed
project clips.

`public.json` records delivered source and project evidence, page-one continuation,
CLI/MCP agreement, physical-gap exclusion, donor deletion, history and service
restart. A barrier holds a successful native sampling reply to cancel a real job.
Repeated reads retain the canceled attempt and qualified artifact status until an
explicit `job.retry`. Artifact `not_requested` with reason `canceled` is distinct
from job state `canceled`; the initial harness expectation was corrected against
the existing job contract.

The ordered-support assertion exposed an actual public availability ordering defect
(`availability-red.json`). The production owner now returns chronological clipped
support; the assertion remains strict. `drop-scenes-red.json` proves omitting scene
rows at the actual response boundary fails the authored oracle. The restored runtime
passes. `oracle-controls.txt` separately proves self-consistent wrong physical
clocks and reversed scene/pause tie order fail the assertions.

`capture-preservation.json` retains all previous exact capture/interruption,
continuation, history and bounded-read checks. Its only coverage change is asserting
scene readiness instead of unsupported scenes; scene rows are never filtered from
those comparisons. Both journeys ran on matching shared runtime hashes. Compact
reports preserve ordered trace runs and original report hashes.

Independent review found the original clock and tie-order oracle gaps; both were
corrected and the actual journey rerun. Final review found no actionable defects;
it checked syntax but did not run native media. The executed native gate is the
retained journey, not the review. Lint and diff whitespace checks pass.

This verifies numeric event evidence and native scene preparation, not visual
screenshot-index acceptance, physical capture, broad scene-detector quality or
project-cut events. No installed app, capture session, speaker playback or model
preparation was used.

[Integrated root verification](../10d-scene-integration/README.md) retains the
service wiring, ordering regression and actual combined-runtime reruns.
