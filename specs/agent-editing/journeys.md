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

[Explicit complete-sentence filler removal](assets/12d-complete-sentence/README.md#managed-public-journey)
now passes managed public editing, inspection, preview, export and undo for the
one user-accepted candidate. Two splits, a joint picture/audio ripple removal and
two explicit gain stacks reproduce the complete accepted PCM exactly, allowing
only mono-to-stereo duplication. This is a usable explicit edit and a real
narration-join journey, not automatic target detection or whole-slice 12 acceptance.

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
restart, plus same-byte capture-mask preview audio. [Project transcript paging and phrase search](assets/10c-public-phrases/README.md)
also pass live CLI/MCP delivery against frozen source transcripts.
[Capture cursor/pause/geometry queries](assets/10c-public-capture/README.md),
[project audio taps](assets/11a-public-project-taps/wired-render/README.md) and
[large source WAV delivery](assets/11a-audio-extraction/README.md) and
[large multi-source project WAV delivery](assets/11a-large-project-audio/README.md) have actual
public journeys. [Project stills](assets/10d-public-project-frames/README.md)
verify delivered picture membership and retained media after project deletion.
[Acquisition-gap project pictures](assets/10d-acquisition-pictures/README.md) verify
public audio-context anchors through frames, retained indexes and preview, with
direct source-video readability preserved; custom direct video masks remain
native/core-only. [Waveform JSON](assets/11-waveform-public/README.md) now verifies actual
raw and processed bucket measurements. [Capture interruptions](assets/10c-public-interruption/README.md) also pass actual
public continuation and terminal-provenance checks. [Acoustic images/spectrograms](assets/11-public-acoustic-images/README.md) pass
actual public delivery and numerical/pixel oracles. [Source/project scenes](assets/10d-public-scenes/README.md)
pass authored physical-clock, mixed-event ordering, repeated/retimed occurrence
and cancellation/retry checks. [Retained source screenshot indexes](assets/10d-source-index-public/README.md)
pass actual CLI/MCP/native delivery and recovery, with controlled empty-admission
cases labeled separately. [Project-cut events](assets/10c-project-cuts/README.md) pass actual public authored
and preservation journeys. [Static layers and geometry](assets/15-layer-public/README.md)
now pass actual CLI/MCP tap, preview, export, unchanged WAV and lifetime journeys.
[Processed clip edits](assets/15-layer-edits/README.md) also pass fractional split
stills, a full preview, unchanged WAV, independent-piece processing, and copied,
moved and trimmed clip taps with exact source timestamps. [Moving-source conformance](assets/15-layer-edit-motion/README.md)
now adds independently changing landmarks, nonaligned moves and whole/range movie checks.
[Project screenshot indexes](assets/10d-project-index-public/README.md) pass native
CLI/MCP media and lifecycle journeys; [fresh-agent interpretation](assets/10d-frame-visibility/skill/report.md)
now correctly distinguishes authored boundaries, displayed frame intervals and gaps.
[Raw PNG/JPEG inspection](assets/10d-source-image-public/README.md) passes public
delivery, lifecycle and fresh skill use; [project image composition](assets/10d-project-image-public/README.md)
and [combined renderer preservation](assets/10d-joint-preservation/README.md) also pass. Speech
cleanup timing and19 ambience listening remain pending. The [finite denoise matrix](assets/denoise-acceptance/README.md) is accepted, including its exact protected-word/channel/noise auditions. Rows below describe the full acceptance requirement; their owning slice evidence records progress.

| User scenario | First live owner | Required observable result |
| --- | --- | --- |
| Bring in another video/audio file; reuse past-project media | 02 baseline and22 cross-project/package journey verified | CLI/MCP import/get agree; owned bytes survive external path and donor deletion. |
| Insert footage into a sequence or overlap it as a presenter | 09 insert, 15 overlay | Exported frame counters show intended sequence and independent overlapping layers; existing narration remains at its requested times. |
| Keep audio and replace video; keep video and replace audio | 09 | Decode both planes; the replaced plane changes while the protected plane retains source membership and timing. |
| Stretch narration while showing new video | 14 | Requested duration, protected speech/pitch and explicitly linked versus independent video timing are verified in delivered media. |
| Add music and independently adjust its level | 09 constant levels, 16 animated levels | Actual mixed PCM contains both inputs at explicit levels; adding an unused/silent track does not change volume. |
| Crop, change aspect ratio, zoom, rotate, fit and animate | 15 static, 16 animated | Delivered frames preserve asymmetric landmarks, pointer mapping and requested canvas geometry at boundaries/interior times. |
| Remove ums, accidental repeated words and false starts | 12b; 12d verifies one explicit accepted filler cut through public media/history | Real labeled speech targets are removed; protected neighboring words and deliberate emphasis remain. The broader inventory and independent boundaries remain open; transcription alone cannot pass this row. |
| Slow only rushed speech | 14 | Edited passage duration/pitch and joins pass while untouched neighbors remain unchanged; related video/captions follow declared links. |
| Generate corrected words or a phrase in the selected local voice | 19 | Use same-video, external-file and past-project references; verify requested words, identity, level, entrance/exit timing and continuity separately. No lip-sync or mandatory B-roll is imposed. |
| Match replacement ambience without extra silence or echo | 19 | Original room tone is explicitly retained/mixed; inspect/audition generated joins, levels and protected context. User-rejected cloning mode is not accepted as a substitute. |
| Set/reorder/bypass processing on clip, track, nested group and output | 04 state journey; 09/15/15a delivered-media journey | Public get/set/undo/replay agree; real noncommuting pairs demonstrate order. Parent steps operate on combined results, not copied child settings. |
| Insert new narration into a processed track; give one phrase different treatment | 09 gain, 15a denoise | New clip contributes to track processing with an empty clip stack. Exceptions use clip treatment or a separate track; no inherited overrides. |
| Replace processed media, with preserve or explicit reset | 04 state, 09/15/15a media | Compatible steps persist; reset removes them; invalid source-specific settings reject atomically with diagnostics. Padded tails retain intended processing. |
| Split/trim/duplicate/move processed clips | 04 state, 09/15/16/15a media | Pure split leaves sound/look unchanged; independent edits affect only the chosen copy/piece. Verify fractional boundaries, curves and stateful preparation. |
| Apply a processor only to a sentence or animate its strength | 16, 15a denoise integration | Exact activation/transition timing, dry neighbors and range/full parity; no hidden project-duration change. |
| Insert a pause with explicitly retained background ambience | 09/16; [synthetic public mechanics verified](assets/pause-audio-public/README.md) | Public gap insertion plus selected room-tone placement/repetition and explicit gain/fades; independently check the selected sample contains no unwanted speech, audition seams, preserve unaffected retained PCM under its new timeline mapping outside the inserted interval and protected join windows, report authored fades and resampling influence separately, and verify undo/export. No implicit denoising. |
| Insert a pause and independently reduce the clip's background noise | 15a; [synthetic public scope/mix verified](assets/pause-audio-public/README.md) | The agent explicitly selects processing scope and settings; inspect noisy versus processed speech across the pause, preserve duration and immutable originals, verify bypass/undo, and add no room-tone layer automatically. Neither alternative is the tool's default preference. |
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

[Project images](assets/10d-project-image-public/README.md) add actual CLI/MCP
PNG/JPEG insertion and overlap, image-over-video transparency, repeated placements,
ordered crop/placement/opacity, dry taps, retained indexed PNGs, preview/export and
cache/history/restart/deletion journeys. Timeless image identity is distinct from
video sample provenance. Fresh product-skill use and [combined renderer verification](assets/10d-joint-preservation/README.md)
pass; this does not close animated processing or broad color/scale gates.

[Indexed asset metadata inspection](assets/20d2-asset-pages/README.md) reconstructs
all 200,000 physical rows of the actual 100,000-run admitted source through CLI/MCP.
`asset.get` supplies headers/counts; `asset.segments` preserves ordinal rows and
empty gaps. Ordinary media/font import and replay behavior remain covered.
