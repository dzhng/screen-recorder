# Agent-operated video editing

Status: implementation in progress; assets and shared preparation jobs verified in the isolated service, structural edits, stack authoring and durable public project state/deletion verified; native composition rendering and public preview integrated. Updated 2026-09-28.
The [product CLI skill](../../skills/screenrec/SKILL.md) documents current public
capabilities only. This plan supersedes the discovery map's operational queue;
the [map](MAP.md) and [processing map](PROCESSING-MAP.md) record user intent.
[Ordered processing](processing.md) owns the accepted one-stack-per-target API.

## Next Agent Prompt

Implement the entire local agent-operated editor; the checklist below and each
slice's acceptance gates remain the scope. Read [contracts](contracts.md),
[architecture](architecture.md), [verification](verification.md),
[journeys](journeys.md) and [processing](processing.md). The product skill describes
available public operations only; the installed app has not switched engines.

Complete [10c occurrence queries](slices/10c-occurrence-queries.md) and
[10d picture/index inspection](slices/10d-frame-inspection.md). Public source and
project frames pass, including [blind product-skill use](assets/10d-frame-skill/README.md).
[Scene ownership](assets/10d-scene-ownership/README.md) is integrated with actual
recording/package preservation. [Selected-source sampling](assets/10d-source-scene-sampling/README.md)
and [capture-end projection](assets/10c-capture-interruption/README.md) are integrated
mechanisms. [Retained scene indexes](assets/10d-source-scene-retention/README.md)
and [queued preparation](assets/10d-source-scene-preparation/README.md) are integrated.
[Public source/project scene events](assets/10d-public-scenes/README.md) now pass
actual preparation, physical clocks, repeated/retimed occurrences and recovery.
[Fresh scene skill use](assets/10d-scene-skill/README.md) verifies complete project
coverage and explicit prerequisite retry. [Screenshot ownership](assets/10d-index-ownership/README.md)
now preserves source indexes and recording packages under Catalog 10.
Finish retained screenshot selection/index delivery; project-cut semantics still
need a concrete definition. [Public interruption](assets/10c-public-interruption/README.md)
now passes actual CLI/MCP continuation and the combined-runtime journey.
Retain the full [10 evidence](slices/10-project-evidence.md) umbrella scope.

In parallel, implement [15 layers and geometry](slices/15-layer-geometry.md):
compiler-owned crop/fit/transforms and native layered execution, with independent
public presenter/stack-order journeys. The opaque-output profile and pointer
presentation gates remain explicit; no new geometry capability is verified yet.

Retain [11 acoustic artifacts](slices/11-audio-inspection.md).
[Public waveform JSON](assets/11-waveform-public/README.md) verifies raw/processed
measurements, all nested taps, automatic overview, history and dependency retry.
[Blind waveform skill use](assets/11-waveform-skill/README.md) also passes.
[Labeled native images](assets/11-acoustic-raster/README.md) pass visual review.
[Public acoustic lifecycle](assets/11-acoustic-lifecycle/README.md) passes masked FFT
context, cache eviction, explicit retry, history and restart. [Fresh image-based skill use](assets/11-acoustic-skill/README.md) also passes.
Track retiming-dependent conformance before closing 11. PCM analysis is independent of event queries.

[11a PCM delivery](slices/11a-audio-delivery.md) is verified, including actual
[source WAVs](assets/11a-audio-extraction/README.md) and
[multi-source project WAVs](assets/11a-large-project-audio/README.md) above 1 GiB.
Execution pins and concurrent staging pass combined-runtime preservation.
[Continuous availability](assets/11a-touching-support/README.md) preserves exact
WAV bytes across touching support while retaining real holes.
AAC comparisons retain the documented bounded seek-dependent float difference;
counts/clocks/endpoints and lossless byte parity remain exact. Never pad missing
samples, shorten source support or change thresholds to hide failures.

Current public evidence:
- [Paging/search](assets/10c-public-phrases/README.md) and
  [bounded/acquired-gap reads](assets/10c-public-bounds/README.md) use frozen ASR
  rows for exact projection, not fresh inference. [Source acquisition](slices/10b-source-acquisition.md)
  separately retains actual native transcription and capture-mask media evidence.
- [Capture journey](assets/10c-public-capture/README.md) uses actual acquisition
  normalization and complete cursor/pause/geometry row oracles; the interruption
  extension includes synthetic terminal journals and frozen-transcript preservation.
  [Source/project scene events](assets/10d-public-scenes/README.md) are now verified;
  project-cut events remain explicitly unsupported.
- [Project pictures](assets/10d-public-project-frames/README.md) verify actual
  membership, history and owned-media survival after project deletion.
  [Source pictures](assets/10d-source-frame-public/README.md) verify selected
  streams, physical gaps, retained capture bindings and exact reviewed pixels.
  Custom public video exclusion masks and raw still-image admission remain open.
- [Transcript](assets/10c-project-skill/README.md),
  [audio/capture](assets/11a-10c-inspection-skill/README.md) and picture skills
  pass blind agent use, as does waveform measurement; none establishes listening.

Use isolated homes and frozen workers. Imported sources never fabricate recording
rows or narration roles. Preserve capture clocks/acquisition provenance separately
from physical support. The installed app still uses the recording engine; cutover,
scale and physical/listening acceptance remain explicit later gates.

Evidence boundaries to preserve:

- [09 public preview/export](slices/09-first-preview.md) is verified. The complete
  journey still passes after 10b integration, with all 19 reviewed images unchanged.
- [10b integration evidence](assets/10b-acquisition-integration/README.md) records
  405 passing core checks followed by broad-run deadlines and controlled passing
  reruns. Do not restate this as one green final broad invocation. Scale remains 24.
- [10b source routing](assets/10b-source-routing/README.md) records focused public
  readiness, source/recording preservation and model shutdown checks. The actual
  source journey separately verifies native inference and differing-mask media.
- [10b transcript storage](assets/10b-transcript-ownership/README.md) preserves the
  306 retained native words and recording/package behavior; source planning and
  public asset reads and their actual native/historical journey are verified.
- Risk gates remain open in 06 (broader encoding/color), 08 (audio conformance/scale),
  12/12b (speech labels/timing and cleanup), 12c/15a (denoise state/quality), 13a
  (stretch speech/listening), 18/19 (voice identity/delivery/joins), and 20/21
  (physical camera/capture). Numerical success does not establish listening quality.
  The [matched speech alternative](assets/12-verbatim/README.md) fails completeness
  and p95 timing. [Separate forced alignment](assets/12-alignment/README.md) also
  fails p95 and memory; independent audible labels and joins remain open.
  [Denoise compensation](assets/12c-denoise-timing/README.md) passes limited
  numerical timing gates; edited-input state and speech quality remain open.

Keep sources intact, use isolated homes and frozen native binaries, and never
change test thresholds to hide failures. No history migration, editing GUI,
lip-sync model or mandatory creative approval is required. Each committed pass
updates its slice evidence and this pickup, audits choices and synchronizes the
product skill only with verified public operations. Full release acceptance and
installed-app cutover remain later checkpoints, not consequences of green unit tests.

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
- [ ] [10c — Bounded occurrence evidence and phrase search](slices/10c-occurrence-queries.md)
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
