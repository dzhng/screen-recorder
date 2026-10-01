# Verification contracts

All commands named in new slices are **planned harness entry points**. Their
owning slice creates them before claiming the checkpoint. Existing repository
commands come from [package.json](../../package.json); do not substitute another
package manager or silently invent a passing command.

## Corpus and evidence

Slice 00 freezes a corpus manifest with generated asymmetric frame-counter clips,
different rates/orientations, distinct audio tones/impulses, stills with alpha,
and copies/excerpts of [real narration](../../fixtures/narrated-workbench/README.md).
Never replace real speech tests with generated speech. A second take, external
voice reference and camera take can be supplied later through the same manifest;
synthetic or copied stand-ins prove plumbing only and are labeled accordingly.

Evidence stays under `assets/<slice>/`: exact invocation, versions, hashes,
timings, memory, expected/actual values, decoded probes and critique verdicts.
Each slice starts with `Status: not started`; replace it with actual results and
unresolved gates when implementing. No document checkbox closes a physical or
listening gate that did not run.

## Incremental live journeys

The [journey inventory](journeys.md) is mandatory coverage. Every capability slice
adds its public CLI/MCP/service journey as soon as that execution path exists;
25 integrates and reruns the complete workflow. Keep engine, live-state,
live-media and listening/physical results separate. No skipped placeholder tests
can turn an unavailable capability into passing journey coverage.

## Implementation readiness and acceptance

Verify primitive contracts at their actual seams: explicit inputs, complete
outputs/provenance, deterministic execution, preserved source media, failure,
restart and undo. Integration preparation can proceed with pinned references and
controlled responses; report that scope separately from actual device/model
execution. An open acoustic or physical claim does not block unrelated wiring,
preservation checks or bounded diagnostic work.

The [selected Parakeet baseline](../recording-for-ai/slices/04-local-speech-gate.md)
ships best-effort recognized fillers with measured timing limits. Preserve that
decision. Current public parity does not require a replacement model to win first
and does not certify accurate acoustic cuts from estimated word times. Any
replacement must earn its own quality/provenance evidence before adoption.
Physical synchronization, live lifecycle, stop completion and final installed
cutover require evidence for those actual claims; fixtures cannot manufacture it.

Before involving the user, reuse saved labels, accepted auditions and the existing
four-minute capture. A human task must answer one concrete missing technical fact;
explain what changed and why retained evidence cannot answer it. Do not repeat an
accepted comparison, request personal editing choices or prescribe another whole
recording as routine verification. Missing perception is reported unverified.

If a new acoustic mark is genuinely necessary, reuse the existing interactive
workflow: meaningful original context, a clearly identified word/occurrence,
waveform click then Next, and playback beginning exactly at the click. Do not ask
for typed timestamps or prefill the listening answer from ASR. Verify nonzero
audio duration before presenting the page. For changed-output auditions, show the
original beside one meaningful complete sentence and state one bounded technical
question; do not offer unexplained fragments or start audible playback automatically.

## Deterministic correctness

- Use named clip/asset IDs and manually specified expected frame/tone membership
  in fixtures. Conformance vectors verify the owner without restating its entire
  algorithm in a second application implementation.
- Verify exact edit effects, rollback, replay and undo, not just response counts.
- Assert decoded frame membership and geometry at boundaries and interiors.
  Different encodes permit documented codec error; compare source selection,
  transforms and actual timestamps, not compressed-file byte equality.
- At the PCM stage, verify exact intended output sample count and channel layout;
  account separately for encoder delay and padding. Long-project A/V drift must
  stay within one output frame, with no accumulating step at each edit.
- Range-preview samples agree with full-render samples at the same project times.
  Tests cover phase offsets not aligned with frame/sample boundaries.
- Every mutation test suite includes lost response, same-request replay after
  restart, changed-argument conflict, stale revision, competing writers and a
  failure after earlier batch operations would have succeeded.

## Audio quality gates

Stretch experiments cover 0.8×, 0.9×, 1× and 1.25× playback speed, whole phrases and
local changes adjacent to untouched speech. Those are acceptance cases, not a
permanent API limit. Measure output duration, latency compensation, tail handling,
pitch shift on a stable tone, intelligibility and joins on real narration.
Target tone pitch error is below 1%; the speech listening judgment is independent.
Do not threshold natural waveform discontinuities and call that a listening test.

For speech-evidence primitives, use independent acoustic labels in the real
corpus to measure recognized speech, filler coverage and word boundaries. Repeated
words must remain inspectable; the product does not judge their intent. Explicit
fixture edits declare target ranges and protected words as inputs. Verify that
only the requested targets are removed, retained media is preserved and undo
restores it. Report precision/recall and timing distributions with sample counts
and omissions. An ASR transcript or forced aligner cannot be its own ground truth.
Preserve the existing failed boundary measurement as baseline; retain the quality
targets of median ≤100 ms and p95 ≤250 ms on expanded marks, and inspect authored
joins for clipped speech. Their numerical pass/fail and coverage remain separate
from current-baseline public parity; do not relabel a miss as a pass or claim a
general phoneme-safe editing guarantee. Personal keep/remove choices and
accidental-versus-deliberate judgments are not project prerequisites; follow
[editorial control](architecture.md#editorial-control).

For voice replacement, fix desired texts and use same-take, external-file and
past-project references. Evaluate requested words/pronunciation, voice identity,
delivery, intelligibility and contextual join separately. Include short word and
whole-phrase replacements. A transcription score alone does not establish voice
similarity; speaker embeddings alone do not establish correct pronunciation.
Keep the generated asset usable even when the model is later unavailable.

An audio-capable independent reviewer can provide listening evidence. If no such
reviewer is available, request the user's audition and record the gate as
unverified; do not block unrelated work or infer a pass from silence. The external
agent's autonomous export behavior must disclose that limitation in its report.

## Visual gates

Every visual slice names one judged variable and crop/mask. Preserve accepted
geometry while judging typography, and accepted static geometry while judging
motion. Whole-frame integration belongs to final acceptance. Numerical frame,
color and geometry probes accompany aesthetic judgment.

When a target/prior shot exists, run
[compare-screenshots](../../.agents/skills/compare-screenshots/SKILL.md) to gather
telemetry and a less-wrong verdict. Then run an unprimed
[screenshot-critique](../../.agents/skills/screenshot-critique/SKILL.md) as the **last
visual check before acceptance**. Feed it the shot and user task, not the desired
verdict or the implementer's explanation. Repair actionable defects and repeat
only the affected checks.

Show review shots with [preview-shots](../../.agents/skills/preview-shots/SKILL.md).
Human visual review is non-blocking: allow about five minutes while continuing
independent work, then decide from the evidence, record rationale and close the
opened shots if the user is silent. This is not approval inferred for capture or
other unrelated actions. No editor GUI is required; use CLI reports, local media
and bounded verification contact sheets.

## Preservation matrix

The old release still has unclosed acceptance gates. Preserve verified behavior;
do not convert inherited pending gates to passed. Slice 00 records a precise
baseline manifest of the tests/artifacts below before replacement. Slice 23 owns
the matched-input comparison at public production entry points and deletion of
old owners after parity passes.

| Behavior | Existing evidence/test owner | New owner / parity gate |
| --- | --- | --- |
| Capture, pause, interruption recovery, truthful gaps | `helpers/mac/Tests/ScreenRecorderCaptureTests`, `apps/service/src/capture-lifetime.test.ts`, recording spec slices 01/02 | Capture source boundary and slice 21; compare source clock/journal/recovery outcomes, not new catalog IDs. |
| Frame membership and source presentation | `helpers/mac/Tests/RenderMembership`, `helpers/mac/Tests/MovieTiming`, native frame tests | Slices 06/07/23; matched source frames including joins, gaps and held tails. |
| Raw cursor and pointer placement | `packages/core/src/presentation-evidence.test.ts`, `presentation-pointer.ts`, native pointer probes | Slice 15 then 23; same source cursor/geometry and chosen presentation instants under a single-clip identity transform. |
| Narration/system acquisition and excerpts | `packages/core/src/audio.test.ts`, native audio tests | Slices 08/11/23; decoded PCM and missing-role/gap semantics before intentional mix changes. |
| Transcript, partial words, generation pins | `packages/core/src/transcript-pages.test.ts`, `transcript.test.ts`, `event-pages.test.ts` | Slice 10 then 23; identical source evidence and single-occurrence projected meaning, with explicit new clip IDs. |
| Idempotent edits, conflict/undo/history | `packages/core/src/library.test.ts` | Slices 03/04/23; same replay/atomicity guarantees with full documents. Old span shape is an intentional difference. |
| Pinned preview/export and recovery | `packages/core/src/preview.test.ts`, service export/package suites | Slices 09/22/23; same readiness/failure/recovery guarantees, new project/dependency identity. |
| Relocated inspection | `packages/core/src/package-manifest.test.ts`, `apps/service/src/package-*.ts` tests and package harnesses | Slice 22; new-format package relocation/edit/undo with all old directories unavailable. No old-format migration is promised. |
| CLI/MCP equivalence and actual media delivery | `apps/cli/src/main.test.ts`, protocol schemas, `lab:client-image` | Every public capability, then slice 25; compare normalized results and actual delivered image/audio artifacts. |

Exact suite paths must be checked by slice 00 (some native suites have generated
launchers). No green claim is based only on the names in this table.

## Scale and acceptance

Slice 24 uses 5-minute and 2-hour projects with 500 and 10,000 clip occurrences,
including repeated sources. Target cached 250-row inspection p95 ≤250 ms; target
warm ten-second 1080p preview ≤15 seconds and ≤4 GiB non-model worker RSS on the
observed M5 Pro host. These are proposed acceptance budgets, not measurements.
Separate cold decode/model setup from warm costs. Doubling timeline length must
not double the memory required for the same bounded query; publish measured
scaling, queue waits and cancellation responsiveness. If budgets fail, profile
and reslice the owning seam before claiming acceptance; never add unbounded caches.

[25](slices/25-agent-acceptance.md) runs a bounded fixture brief through a fresh
external caller using the consumer skill and advertised CLI/MCP. Its report
includes selected revision, source/generated media provenance, requested effects,
output paths and verification limits. This is technical capability acceptance,
not a personal editing assignment or a mandatory user approval sequence.

Run focused tests per slice. At final cutover/acceptance run root build, typecheck,
test, lint and format checks plus relevant native/media harnesses. Follow
[review](../../.agents/skills/review/SKILL.md) and the substantive-change
[Codex review](../../.agents/skills/codex/SKILL.md) policy before implementation
closeout; the present planning-only pass does not execute those runtime gates.

## Ordered processing gates

The [processing contract](processing.md) applies through every target scope.
03b proves acyclic single-parent routing and unchanged clip timing; 03c proves
atomic get/set, stable identities, repeated steps, bypass and structural lifecycle.
04 repeats edits through CLI/MCP with revision replay/undo. 05 proves bounded
compilation and target/tap identity. No JSON-only check proves DSP execution.

08 checks nested gain placement, empty/bypass identity and unchanged amplitude
when adding a silent track. Two gains commute: 15a must prove real noncommuting
audio order and combined-input semantics using the frozen denoiser. 15 checks
nested translucent visuals, ordered geometry and composed pointer mapping; 16
checks activation/animation through exact splits and padding. Visual owners retain
the existing compare-screenshots and final unprimed screenshot-critique gates.

12c/15a require protected speech, raw and separately loudness-matched auditions,
clean/noisy controls, post-retime speech, overlaps, exact samples/latency, poisoned
excluded inputs, chunk-size/reset behavior and full/range equivalence. Independent
listening remains distinct from ASR/noise metrics. Pure splits preserve DSP state;
changes to retained input invalidate it. Failed state isolation is a failed gate,
not permission to weaken the existing excluded-speech contract.

22 retains processed current/history playback without donor model cache. 24 bounds
group depth/width, stack length, context/preparation work and retained storage.
25 demonstrates real agent get/set, exceptions via clips/separate tracks, optional
denoise, replacement, split, preview/export, undo and package relocation.
