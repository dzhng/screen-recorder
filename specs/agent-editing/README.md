# Agent-operated video editing

Status: implementation in progress; assets and shared preparation jobs verified in the isolated service, structural edits, stack authoring and durable public project state/deletion verified; native composition rendering and public preview integrated. Updated 2026-09-28.
The [product CLI skill](../../skills/screenrec/SKILL.md) documents current public
capabilities only. This plan supersedes the discovery map's operational queue;
the [map](MAP.md) and [processing map](PROCESSING-MAP.md) record user intent.
[Ordered processing](processing.md) owns the accepted one-stack-per-target API.

## Next Agent Prompt

Implement the entire local agent-operated editor. Every open slice and global
requirement below remains in scope. Read [contracts](contracts.md),
[architecture](architecture.md), [verification](verification.md),
[journeys](journeys.md) and [processing](processing.md). The product skill teaches
verified public operations only; the installed app has not switched engines.

Current pickup and priority:

1. Finish [10d picture/index inspection](slices/10d-frame-inspection.md). Source index
   [ownership](assets/10d-index-ownership/README.md),
   [selection](assets/10d-source-index-selection/README.md),
   [queued preparation](assets/10d-source-index-jobs/README.md) and
   [service delivery](assets/10d-source-index-service/README.md) are integrated.
   [Actual native CLI/MCP journeys](assets/10d-source-index-public/README.md) and
   [fresh product-skill use](assets/10d-source-index-skill/README.md) pass.
   [Project cuts](assets/10c-project-cuts/README.md), [fresh cut skill use](assets/10c-cut-skill/README.md)
   and [changed-generation inspection](assets/10c-public-generations/README.md)
   complete [10c occurrence queries](slices/10c-occurrence-queries.md). The generation
   gate simulates a recipe release; native scenes and frozen-ASR transcripts retain
   separate evidence boundaries. Cache-owner eviction remains a core gate.
   [Compiler frame-boundary selection](assets/10d-project-index-clock/README.md)
   and [candidate selection](assets/10d-project-index-selection/README.md) are
   integrated, along with the [retained project domain](assets/10d-project-index-domain/README.md).
   [Queued materialization](assets/10d-project-index-processing/README.md) and
   [public CLI/MCP/native journeys](assets/10d-project-index-public/README.md) now
   pass, including retry, retained history and deletion.
   [Fresh skill use](assets/10d-project-index-skill/README.md) exposed competing
   frame-range meanings. [Public visibility](assets/10d-frame-visibility/README.md)
   now uses the compiler interval, with native validation intact and all 22 PNGs
   unchanged. [Fresh interpretation](assets/10d-frame-visibility/skill/report.md)
   now correctly distinguishes authored edges, displayed intervals and unknown gaps.
   [Public acquisition-gap pictures](assets/10d-acquisition-pictures/README.md)
   now verify audio-anchored video across selected capture gaps, including
   [combined native verification](assets/10d-inspection-integration/README.md). Raw still-image inspection and fresh skill use now pass. Next complete project
   still-image composition and indexing; direct custom video-mask
   admission is not provided by the current capture producer.
   Retain the complete [10 umbrella](slices/10-project-evidence.md).
2. In parallel, implement [15 layers and geometry](slices/15-layer-geometry.md).
   [Authored fixtures/oracle controls](assets/15-layer-fixtures/README.md) are
   integrated. [Compiler/native geometry](assets/15-layer-geometry/README.md) now
   passes combined-worker admission, layer, source-orientation and existing public
   picture/index preservation gates. Immutable probe state and pixel recipes have
   new identities. [Public presenter/stack journeys](assets/15-layer-public/README.md)
   pass. [Fresh skill use](assets/15-layer-skill/README.md) produces correct final
   media. The public receipt now excludes private execution coordinates;
   [fresh reinspection](assets/15-layer-skill/reinspection/report.md) correctly
   reads the same layout, and all 62 public journey images remain unchanged.
   [Pointer authoring/compiler](assets/15-pointer-contract/README.md) is integrated;
   [exact source history](assets/15-pointer-history/README.md) is integrated.
   [Shared source-time sampling](assets/15-pointer-sampling/README.md) is integrated;
   [Queued preparation and native replay](assets/15-pointer-execution/README.md) now pass their scoped checks; public admission and renderer bindings remain unavailable. [Processed split, duplicate, move and trim](assets/15-layer-edits/README.md)
   pass their static media/tap checks. [Moving-source journeys](assets/15-layer-edit-motion/README.md)
   now verify fractional edits, full/range previews and exact protected audio.
   [Combined verification](assets/15-pointer-integration/README.md) preserves source-image, acquisition and layer behavior. Finish public pointer admission and geometry. The broader
   final-output profile remains open.
3. Advance the unresolved media risks before adopting processors: speech
   evidence/cleanup (12/12b), denoise quality/state (12c/15a), stretch endpoints
   and listening (13/13a/14), then local voice identity/joins (18/19). Continue
   other dependency-ready slices; these priorities do not remove later scope.

Compact evidence ledger:

- [Preview](assets/09-first-preview/README.md) and
  [export](assets/09-first-export/README.md) verify independent audio/video
  replacement, insertion, music, constant gain stacks and historical results.
  General layering, retiming and processors beyond constant gain are not implied.
- [Source acquisition/transcription](slices/10b-source-acquisition.md) includes
  actual native inference. [Project phrase paging](assets/10c-public-phrases/README.md)
  uses frozen transcript rows to verify projection, not fresh speech accuracy.
  [Capture interruption](assets/10c-public-interruption/README.md) and
  [source/project scenes](assets/10d-public-scenes/README.md) pass actual public
  journeys; [fresh scene skill use](assets/10d-scene-skill/README.md) also passes.
- [Project pictures](assets/10d-public-project-frames/README.md),
  [source pictures](assets/10d-source-frame-public/README.md) and
  [typed no-picture delivery](assets/10d-source-empty-observation/README.md) pass
  their named gates. [Acquisition-gap project pictures](assets/10d-acquisition-pictures/README.md)
  use public audio-context anchors; direct narrower video masks remain native/core-only.
  [Raw image inspection](assets/10d-source-image-public/README.md) passes its native
  CLI/MCP lifecycle journey with unchanged reviewed native pixels, fresh skill use
  and resized recovery review. Project still composition/indexing
  remains required. No new layer capability is implied by raw inspection.
- [PCM delivery](slices/11a-audio-delivery.md) includes source and multi-source
  project WAVs above 1 GiB. [Waveform JSON](assets/11-waveform-public/README.md),
  [acoustic images/lifecycle](assets/11-acoustic-lifecycle/README.md) and
  [fresh image-based skill use](assets/11-acoustic-skill/README.md) pass. Preserve
  [touching-support continuity](assets/11a-touching-support/README.md), exact
  lossless counts/bytes and the documented bounded AAC seek difference.
  [11 acoustic inspection](slices/11-audio-inspection.md) still needs retiming conformance.
- [Verbatim speech](assets/12-verbatim/README.md) and
  [forced alignment](assets/12-alignment/README.md) fail their timing/memory gates.
  The [text-only diagnostic](assets/12-alignment-text-coverage/README.md) fixes one
  onset but still fails p95/memory. [Half-precision alignment](assets/12-alignment-precision/README.md)
  passes the resident-memory gate with unchanged marked errors, but one unmarked
  edge moves; independent boundary evidence and listening remain open.
  [Conventional denoise](assets/12c-denoise-timing/README.md) and
  [learned denoise](assets/12c-rnnoise-timing/README.md) have measured compensation
  and state sensitivity. Both reject independent resets for a pure split;
  neither establishes protected speech quality or a production state policy.

Use isolated homes and frozen workers. Imported assets never fabricate recording
rows or narration roles; preserve physical support and acquisition provenance.
Never pad missing samples, truncate support or relax thresholds to conceal a
failure. Numerical checks cannot close listening or physical-camera acceptance.
Broader encoding/color (06), audio conformance/scale (08), camera (20/21),
portability (22), cutover (23), scale (24) and autonomous acceptance (25) remain
explicit gates. No history migration, editing GUI, lip-sync model or mandatory
creative approval is required. Each committed pass updates its owning evidence,
choices and this pickup; the global checklist is the completion boundary.

## Outcome and boundaries

The user can ask an external agent to create a screen/webcam tutorial from several
takes and imported footage: remove mistakes, audible fillers and accidental word
repetitions; slow rushed passages; insert or overlap footage; replace video while
keeping sound or vice versa; add music, text, captions and keyframed zooms; generate
replacement words from selected local reference audio; verify and export a local
video and portable editable project at requested dimensions. Optional ordered
audio/video processing supports clips, tracks, nested groups and final output,
including verified local noise reduction, bypass, windows and supported animation.
Parent stacks process combined results; no inherited settings or member overrides.

CLI is primary; MCP exposes exactly the same operations. Commands edit a managed
project in atomic, undoable, revision-bound batches. General composition/keyframe
primitives underlie convenience commands. All media and inference remain local
after explicit model preparation. The agent chooses wording, references, pacing,
B-roll, layouts, ducking and other creative decisions. The engine provides evidence
and precise operations. References may come from current footage, any admitted
local audio/video, or past projects; no required voice enrollment.

No editing GUI, hosted sharing, embedded editorial assistant, lip-sync generation,
old-history migration, or mandatory draft approval is in this release. Existing
menu-bar capture controls remain. A verification workbench/probe is not a product
editing UI. Broad professional-editor parity beyond this named workflow is not
implied; capabilities stay extensible through the one typed composition model.

## Roadmap to review

| Checkpoint | What becomes usable | Owning slices |
| --- | --- | --- |
| Prove the risky mechanisms | Frozen media/voice/stretch experiments and exact timing contract | 00–01, 06, 12/12c, 13, 18, 20 |
| First working edit | Import two clips, independently replace audio/video, undo, preview and export | 02–09 |
| Give agents reliable evidence | Every repeated/reordered word/event, waveform/spectrogram, full audio delivery, verified cleanup pipeline | 10–12b |
| Full composition | Ordered processing, retiming, presenter layers, keyframes, captions and local generated speech | 14–19 |
| Record and carry projects | Separate synchronized webcam, durable dependencies and editable relocated packages | 20–22 |
| One production engine | Cutover with preservation parity, scale checks and autonomous real-agent acceptance | 23–25 |

Numbers identify contracts, not a mandatory serial order. Dependencies in each
slice are authoritative. Research branches run early, with production adoption
only after their recorded gates pass.

```mermaid
flowchart LR
  Corpus[00 Corpus] --> Model[01 Composition]
  Model --> Core[02–05 Assets / edits / routing / stacks / compiler]
  Corpus --> Research[06 / 12 / 12c / 13 / 18 / 20 Reproductions]
  Core --> First[07–09 First playable edit]
  Research --> First
  First --> Evidence[10–12b Evidence]
  First --> Editing[14–19 Composition and speech]
  Evidence --> Editing
  Research --> Editing
  Core --> Camera[21 Camera]
  First --> Camera
  Research --> Camera
  Editing --> Package[22 Portable project]
  Camera --> Package
  Package --> Closeout[23–25 Cutover / scale / agent acceptance]
```

The diagram groups branches for readability; it does not imply that voice/camera
or noise research blocks the first preview. Individual dependency lists are checked for cycles.

## Global checklist

- [x] [00 — Freeze fixtures and preservation evidence](slices/00-corpus.md)
- [x] [01 — Composition identity and time](slices/01-composition.md)
- [x] [02a — Shared durable preparation targets](slices/02a-preparation-jobs.md)
- [x] [02 — Immutable asset admission](slices/02-assets.md)
- [x] [03a — Preserve exact edit boundaries](slices/03a-exact-edit-boundaries.md)
- [x] [03 — Structural edits and attachments](slices/03-edits.md)
- [x] [03b — Processing targets and nested routing](slices/03b-processing-targets.md)
- [x] [03c — Ordered stack authoring and lifecycle](slices/03c-processing-stacks.md)
- [x] [04 — Durable projects and shared commands](slices/04-projects.md)
- [x] [05 — Compile bounded execution plans](slices/05-compiler.md)
- [ ] [06 — Reproduce native multi-source rendering](slices/06-render-reproduction.md)
- [x] [07 — Execute video plans](slices/07-video-execution.md)
- [ ] [08 — Independent audio mixing](slices/08-audio-mixing.md)
- [x] [08a — Shared derived-file ownership](slices/08a-derived-cache.md)
- [x] [09 — First public preview and export](slices/09-first-preview.md)
- [x] [10a — Exact source-range occurrences](slices/10a-source-range-projection.md)
- [x] [10b — Source acquisition and selected-stream transcripts](slices/10b-source-acquisition.md)
- [x] [10c — Bounded occurrence evidence and phrase search](slices/10c-occurrence-queries.md)
- [ ] [10d — Direct frames and retained screenshot inspection](slices/10d-frame-inspection.md)
- [ ] [10 — Occurrence-aware inspection](slices/10-project-evidence.md)
- [x] [11a — Shared source and project PCM delivery](slices/11a-audio-delivery.md)
- [ ] [11 — Audio, waveforms and spectrograms](slices/11-audio-inspection.md)
- [ ] [12 — Validate speech cleanup evidence](slices/12-speech-evidence.md)
- [ ] [12b — Adopt verified source speech processing](slices/12b-speech-processing.md)
- [ ] [12c — Reproduce local noise reduction](slices/12c-noise-reproduction.md)
- [ ] [13 — Reproduce pitch-preserving stretch](slices/13-stretch-reproduction.md)
- [ ] [13a — Preserve selected speech at stretch endpoints](slices/13a-stretch-endpoints.md)
- [ ] [14 — Integrate independent and linked retiming](slices/14-retiming.md)
- [ ] [15 — Layers, crop and pointer geometry](slices/15-layer-geometry.md)
- [ ] [15a — Adopt verified noise processing](slices/15a-noise-processing.md)
- [ ] [16 — Keyframes and convenience zooms](slices/16-keyframes.md)
- [ ] [17 — Text and attached captions](slices/17-text-captions.md)
- [ ] [18 — Reproduce local reference speech](slices/18-voice-reproduction.md)
- [ ] [19 — Durable local generation and replacement](slices/19-voice-assets.md)
- [ ] [20 — Prove screen and camera timing](slices/20-camera-reproduction.md)
- [ ] [21 — Integrate synchronized webcam capture](slices/21-webcam.md)
- [ ] [22 — Relocatable editable projects](slices/22-portable-projects.md)
- [ ] [23 — Cut over all consumers and remove old owners](slices/23-cutover.md)
- [ ] [24 — Verify bounded work and long projects](slices/24-scale.md)
- [ ] [25 — Autonomous agent acceptance](slices/25-agent-acceptance.md)

## Review and invariants

- [Contracts](contracts.md) fixes time domains, identity, edit/ripple/link/anchor
  behavior, project storage, inspection and output semantics. New choices require
  an explicit spec update, not an unrecorded implementer guess.
- [Processing](processing.md) owns target routing, atomic get/set stacks, fixed
  execution order, replacement preservation and shared-result semantics.
- [Architecture](architecture.md) gives each concept one owner. A temporary
  development boundary is removed in slice 23; no compatibility wrapper survives.
  Preview/export compile the same document. Generated/imported/captured assets
  share ownership and lifecycle.
- [Live journeys](journeys.md) maps every discussed scenario to its first public
  integration owner. Add journeys as paths land; pure probes do not count as live
  CLI/MCP or delivered-media acceptance.
- [Verification](verification.md) owns preservation, real-audio, scale and agent
  gates. Visual slices explicitly run compare-screenshots against references,
  then unprimed screenshot-critique as the last visual check. Non-blocking review
  uses preview-shots; silence cannot satisfy missing physical/listening evidence.
- [Research](research.md) records primary sources and freezes accepted experiments
  before their adoption. Research failure leaves the feature incomplete and
  triggers its named alternative/reslice, not a passing mock.
- [Implementation choices](choices.md) records decisions made in implementation
  where the plan was silent.
- [Planning decisions](decisions.md) records independent-draft synthesis,
  architectural choices and recursive splitting. It is disclosure, not another
  task list.

Human review surfaces are CLI JSON/diffs, bounded images, playable local clips and
reports. Every slice names a runnable probe created by that slice, a verdict,
its allowed implementation discretion and the feedback that would change it.
No milestone depends on a finished editor GUI.

## Validation of this plan

Planning validation consists of three independent whole-plan drafts (fewest-slices
Codex, risk-first Claude, seam-quality Claude), primary-source research, ownership
and contract review, a dependency/link/required-section audit, and scrollback
reconciliation. The processing amendment adds four independent drafts (three
Codex lenses and Claude Opus), a scoped ownership review and a checked 34-slice
dependency graph. Review fixed denoise dependencies on retiming/automation and
kept fades in the curve owner rather than early audio mixing. No new rendering, voice quality, webcam or performance gate is
claimed passed by planning validation. Implementation evidence lives in the
current handoff and owning slices.

The [original planning report](assets/planning/validation.json) freezes the original
27-slice graph. The [maintenance validation](assets/planning/maintenance.json)
checks the expanded graph and local links after implementation reslicing. These
document checks are distinct from runtime acceptance.
