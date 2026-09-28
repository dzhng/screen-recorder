# Live journey coverage

This is the release acceptance inventory for the scenarios discussed with the
user. A pure reducer test, compiled plan or isolated DSP reproduction is useful
prerequisite evidence; none counts as a live journey pass.

## What live means

Run the actual CLI binary and MCP adapter against the real service, shared catalog,
jobs and native workers in an isolated scratch home. Import retained/generated
fixtures through public asset admission; do not construct database rows or call
the reducer in place of public edits. Obtain media through the advertised artifact
paths, decode it and check the intended result. Do not mock the operation, mixer,
renderer or generation stage being accepted. No editing UI is required.

Add each journey to its owning runnable harness when its public execution path
lands; do not defer all integration until slice 25. Slice 25 reruns and combines
them through a fresh external agent using only the product skill and advertised
schemas. Unavailable paths are reported pending, never skipped into a green suite.

## Scenario inventory

The [public project journey](assets/04-public-projects/README.md) verifies live
state for all four stack targets, reorder/bypass, linked splitting, audio
replacement with preserved video/settings, explicit reset, historical reads,
undo/restore and restart replay. Native fixture import also passes. This is
**state verification only**. The [public preview journey](assets/09-first-preview/README.md)
now verifies delivered pictures and both audio channels for independent replacement,
A–B–A insertion, music levels, all gain-stack scopes, insertion into a processed
track, history, ranges and cancellation/crash recovery. [Public video exports](assets/09-first-export/README.md) also pass pinned replay,
preview-byte parity, cancellation/recovery, abandonment and external-file preservation.
[Selected-source transcripts](assets/10b-source-transcript-journey/README.md)
now pass actual native CLI/MCP stream selection, source paging/search, retry and
restart, plus same-byte capture-mask preview audio. [Project transcript paging](assets/10c-public-paging/README.md) also passes live
CLI/MCP delivery against frozen source transcripts. Project phrase/event queries,
processors beyond constant gain and subjective listening remain pending. Rows below
describe the full acceptance requirement; their owning slice evidence records progress.

| User scenario | First live owner | Required observable result |
| --- | --- | --- |
| Bring in another video/audio file; reuse past-project media | 02 baseline already verified; 22 cross-project/package journey pending | CLI/MCP import/get agree; owned bytes survive external path and donor deletion. |
| Insert footage into a sequence or overlap it as a presenter | 09 insert, 15 overlay | Exported frame counters show intended sequence and independent overlapping layers; existing narration remains at its requested times. |
| Keep audio and replace video; keep video and replace audio | 09 | Decode both planes; the replaced plane changes while the protected plane retains source membership and timing. |
| Stretch narration while showing new video | 14 | Requested duration, protected speech/pitch and explicitly linked versus independent video timing are verified in delivered media. |
| Add music and independently adjust its level | 09 constant levels, 16 animated levels | Actual mixed PCM contains both inputs at explicit levels; adding an unused/silent track does not change volume. |
| Crop, change aspect ratio, zoom, rotate, fit and animate | 15 static, 16 animated | Delivered frames preserve asymmetric landmarks, pointer mapping and requested canvas geometry at boundaries/interior times. |
| Remove ums, accidental repeated words and false starts | 12b | Real labeled speech targets are removed; protected neighboring words and deliberate emphasis remain. Transcription alone cannot pass this row. |
| Slow only rushed speech | 14 | Edited passage duration/pitch and joins pass while untouched neighbors remain unchanged; related video/captions follow declared links. |
| Generate corrected words or a phrase in the selected local voice | 19 | Use same-video, external-file and past-project references; verify requested words, identity, level, entrance/exit timing and continuity separately. No lip-sync or mandatory B-roll is imposed. |
| Match replacement ambience without extra silence or echo | 19 | Original room tone is explicitly retained/mixed; inspect/audition generated joins, levels and protected context. User-rejected cloning mode is not accepted as a substitute. |
| Set/reorder/bypass processing on clip, track, nested group and output | 04 state journey; 09/15/15a delivered-media journey | Public get/set/undo/replay agree; real noncommuting pairs demonstrate order. Parent steps operate on combined results, not copied child settings. |
| Insert new narration into a processed track; give one phrase different treatment | 09 gain, 15a denoise | New clip contributes to track processing with an empty clip stack. Exceptions use clip treatment or a separate track; no inherited overrides. |
| Replace processed media, with preserve or explicit reset | 04 state, 09/15/15a media | Compatible steps persist; reset removes them; invalid source-specific settings reject atomically with diagnostics. Padded tails retain intended processing. |
| Split/trim/duplicate/move processed clips | 04 state, 09/15/16/15a media | Pure split leaves sound/look unchanged; independent edits affect only the chosen copy/piece. Verify fractional boundaries, curves and stateful preparation. |
| Apply a processor only to a sentence or animate its strength | 16, 15a denoise integration | Exact activation/transition timing, dry neighbors and range/full parity; no hidden project-duration change. |
| Reduce background noise optionally | 15a | Actual public preview/export improves noisy speech without losing protected phonemes or shifting timing; bypass reproduces baseline. Listening remains independent of noise-floor metrics. |
| Inspect raw versus processed waveforms, spectrograms, audio and frames | 10/11 | Delivered target/tap artifacts match the rendered result, identify domains/revisions and preserve immutable raw evidence. |
| Undo, export and move an editable project to another location | 09 history/export, 22 package | Current and historical processed results survive relocation and missing donor/model cache; changed model-dependent settings report preparation needs. |
| Record synchronized screen and webcam, then edit them | 21 | Real capture clock and physical camera evidence, independent media edits and synchronized export. Imported footage is not capture acceptance. |
| Complete the full tutorial autonomously | 25 | Real agent combines these operations, handles stale/replayed requests, exports media/package and reports remaining verification limits honestly. |

## Failure and coverage reporting

Public mutation journeys include late-batch rollback, competing writers, stale
revision, lost response/restart replay, changed-argument conflict and no-op edits.
Media journeys include preview/full-export parity, unchanged originals, historical
revision pinning, missing dependencies, cancellation and bounded late-window reads.
Use small named fixture oracles; a green status response without decoded output
cannot establish an editing result. Actual listening/camera acceptance remains
pending when no capable reviewer/device evidence is available.

Retain per-scenario command traces, fixture and output hashes, expected/actual
observations and invocation under the owning slice evidence. Report separately:
**engine tested**, **live state journey verified**, **live media journey verified**,
and **listening/physical acceptance**. Tests that never exercise a required stage
cannot close that stage. No tests change the installed user library, activate
capture, play speakers or seize focus as an incidental test side effect.
