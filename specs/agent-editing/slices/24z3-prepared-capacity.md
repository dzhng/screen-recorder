# 24z3 — Prepared PCM admission capacity

Status: the reachable native/header admission mismatch is corrected and verified
with a quota-boundary fixture. The [evidence packet](../assets/24z3-prepared-capacity/README.md)
owns exact source pins, red/green results and limits.

## One capacity owner

Prepared audio writes the same internal stereo Float32 WAV as project audio.
Admission must use the [canonical internal PCM capacity](../../../packages/composition/src/output-settings.ts),
which reserves the existing native writer's format/fact header allowance. A
minimal WAV-header estimate can admit work that the native writer must refuse
before creating output. This is a correctness mismatch, not a new safety ceiling.

[PreparedAudioStore](../../../packages/core/src/prepared-audio.ts) checks the
compiled sample count before job submission or input retention. The existing
error code/message, complete recipe, public API and retained-output path remain
unchanged. The native writer and frozen worker are unchanged.

## Boundary proof and acceptance

The [prepared consumer regression](../../../packages/core/src/prepared-audio.test.ts)
imports tiny source bytes with an explicit long probe extent and independently
authors two exact frame plans. The existing queue startup barrier permits the
largest supported request to queue without rendering. The next frame refuses
with unchanged job and temporary-reference inventories; no large PCM allocation
is involved. Ordinary prepared preservation, cancellation and recipient adoption,
plus the existing project-output boundary, supply the focused neighboring checks.

No timing claim follows from this capacity check. The prior large-recipe deadline
remains open and was not rerun for capacity arithmetic. Root integration owns
the shared handoff and final acceptance boundary.

[Root integration](../assets/24z3-prepared-capacity/merged-verification.json)
verifies the same boundary on the merged producer with core/service builds.
