# Fresh recognition of rendered revision audio

[The public journey](../../../../packages/test-harness/editing/rendered-speech-public.mjs)
owns case selection, arguments and scratch state. Its `--help` is the invocation
contract. The [accepted report](report.json) retains actual CLI/MCP exchanges and
new inference provenance. [Offline replay](offline-read.json) checks the current
read payload after the engine metadata addition, with rendering, conversion and
recognition deliberately unavailable. No installed app or user library was changed.

## Scope

The source is the authorized phrase-final-trend corpus excerpt. A bounded source
transcript projects its words through a cut inside a retained source-word estimate; a separate
project attempt recognizes the delivered mix. Three independently authored impulses
follow the speech on another track. Their expected output frames are calculated
from authored sample positions, not ASR timestamps. All three observed peaks match
exactly, and every returned row maps from the actual selected first sample.

The report identifies both the requested microsecond window and selected 48k sample
bounds. The retained [16k mono PCM](rendered-pcm.wav) is the exact asset passed to
Parakeet. [Native requests and receipts](native/) preserve the recognition input,
raw result, extraction/compiler operands and finite conversion receipt. Models and
large reusable scratch homes are deliberately not duplicated here.

The worker is a frozen copy built from the parent's integrated `cead551b` native
source. SHA-256: `b6719ae0dbc9493e24bd2992b4addf23bba98c4a3c42ca071f71f517dff187af`.
The source SHA-256 is
`9bc9e36ae2571dd2585db7c36569feb16bdb17c9b2f8029867655f7bcb0df5d7`.
The engine/model revision and model digest are in the report's retained transcript
metadata; ordinary `model.prepare` admitted the already pinned local Parakeet input.

## Important limit

Parakeet still recognized “trend” after that word was cut inside its retained source-word estimate.
The [initial observation](initial-truncation-observation.json) and accepted landmark
run preserve this fact. New recognized text can be identical to projected words or
differ only in punctuation. Neither outcome establishes a clean or defective cut.
The cut position comes from a source ASR estimate, not a new independently labeled
phonetic boundary. This checkpoint proves fresh PCM consumption, sample/project mapping and retained
read lifetime. Contextual speech-boundary judgment and repair remain slice12.

## Controlled regression proof

The [core behavior tests](../../../../packages/core/src/rendered-speech.test.ts)
cover failed original recognition (including byte-identical source/rendered PCM),
missing support, absent models, active cancellation, explicit failed-extraction
recovery and foreign revision/cursor refusal. Source cleanup preserves published
rendered generations through the existing resource references. Mapping, support
refusal and prerequisite retry each have a retained falsification log: deliberately
removing the behavior made the relevant assertion fail, then restoring it passed.
The byte-identical regression was red under ordinary source-job reuse and green
under fresh parent-owned inference.

Scoped verification: rendered/source core files pass24 tests; service public contract
and CLI wait tests pass; CLI/service/protocol typechecks and changed-code lint pass.
Core build/check-types are blocked solely by the base revision's unrelated face-index
contract errors. No whole-suite or release acceptance is claimed. The independent
review verdict is retained beside this evidence.

## Scoped review

[Independent Codex review](review.md) completed successfully and found one confirmed
cache-identity issue: the rendered job omitted the transcript policy. The existing
transcript execution owner now supplies it to rendered identity, matching the source
identity policy.
[The regression](policy-red.log) seeds a retained publication missing that policy;
the unfixed implementation reused historical-policy output. The fixed implementation
admits a new attempt. Rendered/source tests pass24 cases afterward. No media or native
inference recipe changed, so the accepted PCM/landmark proof remains valid.
The reviewer's own test run was blocked before collection by its read-only sandbox;
our separate focused checks provide execution evidence. The skill validator was
unavailable because its Python lacked PyYAML; this pass changes only reference prose.
