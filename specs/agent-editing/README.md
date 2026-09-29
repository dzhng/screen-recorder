# Agent-operated video editing

Status: implementation in progress; assets and shared preparation jobs verified in the isolated service, structural edits, stack authoring and durable public project state/deletion verified; native composition rendering and public preview integrated. Updated 2026-09-29.
The [product CLI skill](../../skills/screenrec/SKILL.md) documents current public
capabilities only. This plan supersedes the discovery map's operational queue;
the [map](MAP.md) and [processing map](PROCESSING-MAP.md) record user intent.
[Ordered processing](processing.md) owns the accepted one-stack-per-target API.
[Reference-style audit](assets/reference-style/README.md) maps the user’s new video
example to the plan; the user kept segmentation outside this run and requested a
[generalized video-segmentation placeholder](../video-segmentation/README.md).

## Next Agent Prompt

Implement the entire local agent-operated editor. Every open slice and global
requirement below remains in scope. Read [contracts](contracts.md),
[architecture](architecture.md), [verification](verification.md),
[journeys](journeys.md) and [processing](processing.md). The product skill teaches
verified public operations only; the installed app has not switched engines.

Current pickup and priority:

[Explicit denoise strength and transitions](slices/15a3b-denoise-transitions.md)
now passes the combined public/native journey and [fresh agent skill use](assets/15a3b-mix-skill/README.md).

1. Continue general [scale](slices/24-scale.md), including complete two-hour
   [prepared-package transfer](slices/24j-prepared-package-scale.md), measured decoder work and remaining query families/history.
   The exact two-hour recipe has been reconstructed against its original hash;
   available disk is insufficient for its transfer preflight. Do not restore multi-GB PCM
   before the measured preflight passes. Generic [package closure](slices/22-portable-projects.md)
   is verified, including changed learned settings refusing stale audio after adoption.
2. [Capture rollout](slices/20d-capture-publication.md) is verified for its
   prerecorded scope, including both-role pause and absent/torn-terminal recovery
   in [20d8](slices/20d8-pause-terminal-boundaries.md). Physical camera acceptance
   and installed cutover remain separate.
3. [Routed scale](slices/24k-routing-scale.md) now passes500/10,000 occurrence
   placement, bounded250-row inspection, exact late PCM and queue/cancellation
   checks on the combined root. [Warm1080p preview](slices/24l-preview-budget.md)
   also meets its15s/4GiB budget, and [fixed-size timeline queries](slices/24m-query-duration-memory.md)
   remain below2x sampled memory when duration doubles. The complete two-hour learned workload,
   combined fragmented-source/history package, and bounded public job inspection
   now pass their scoped gates. Continue speech/denoise/retiming/voice acceptance,
   then remaining camera, package, cutover and autonomous workflow gates. Every
   open slice stays in scope; numerical parity does not replace listening evidence.

The user found the unfamiliar cropped speech confusing. No action on those clips
is required; future comparisons use complete meaningful sentences from their
recording, with the original alongside and one clear purpose.

Output controls09b, scoped static06/15, caption17 and the public preparation/gain
consumer checkpoints pass. The [implementation pickup](assets/implementation-pickup.md)
records active worktrees and frozen worker identities. Segmentation stays outside
this run. Completed experiments are evidence, not a queue to rerun.

Compact evidence ledger:

- [Source sampling cells](assets/15-sampling-cells/README.md) and
  [finished-canvas PNG delivery](assets/15-composed-border/README.md) preserve edges
  through the shared executor, with retained red/green controls and scoped review.
- [Pointer alpha geometry](assets/15-pointer-alpha/README.md) and
  [edit lifecycle](assets/15-pointer-lifecycle/README.md) pass fresh visual review
  and exact combined-worker PNG reproduction. [Static layers](assets/15-layer-public/README.md),
  [moving sources](assets/15-layer-edit-motion/README.md) and
  [output geometry](assets/15-output-geometry/README.md) retain their scoped native
  delivery gates. The [pointer reference diagnosis](assets/15-pointer-chain/README.md)
  rejects a flattened-source oracle and keeps encoded color acceptance open.
- [Opacity/indexing](assets/16-opacity-index/README.md) and
  [zoom](assets/16-zoom/README.md) and [position/rotation](assets/16-pose/README.md)
  frame/edit controls pass on the combined build. [Crop/size/pivot curves](assets/16-geometry/README.md)
  also preserve all numeric geometry domains, including subnormal validation;
  the [encoded animation checkpoint](assets/16-animated-appearance/README.md)
  adds sampled trajectory and clock verification without closing full keyframes. [Explicit fade/zoom conveniences](assets/16-conveniences/README.md)
  pass scoped public PCM/PNG/edit and fresh product-skill checks; listening and
  continuous playback remain separate acceptance gates. [Portable archive relocation](assets/22-portable-projects/README.md)
  and [fresh package/fade skill use](assets/22-package-fade-skill/README.md) pass
  their respective checkpoints, retaining workflow failures and handoff-ID errors.
  Relocation now preserves acquisition identities, raw/normalized evidence and retained
  source-scene, real source-transcript and [source screenshot-index generations](assets/22-source-index/README.md)
  through restart. The [transient adoption boundary](slices/22a-portable-snapshots.md)
  now prepares independent identities before staging and rechecks replay at publication.
  [Project-index relocation](assets/22-project-index/README.md) now preserves current
  and historical generations, including read replay without donor jobs. [Learned prepared results](assets/14a-learned-portable/README.md) now survive
  public package transfer with processing unavailable; exact-font history relocation passes the
  [literal-caption package journey](assets/17c-literal-text/README.md); [historical package export](assets/22-historical-export/README.md)
  now retains the selected moment and its undo stack without later donor edits.
- [Real narration preservation](assets/08-narration-preservation/README.md) verifies
  unchanged complete PCM through visual-only edits, history, restart and fractional
  delivery; listening and encoded quality remain separate.
- [Mixed compressed rates and acoustic axes](assets/08-11-rate-conformance/README.md)
  pass their named clock/arithmetic/image gates. One AAC cross-invocation float
  mismatch remains unresolved; its failed report and verification limits stay visible.
- [Physical-segment audio](assets/08-physical-segments/README.md) passes exact
  full/range/split checks after the converter buffer-state fix. [Thirty-minute A/V](assets/08-av-drift/README.md)
  passes 120 fractional edits, separating declared PCM length from AAC padding.
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
  and resized recovery review. [Project still composition/indexing](assets/10d-project-image-public/README.md)
  passes its own public media/lifecycle and fresh skill gates; [combined renderer
  identity and preservation verification](assets/10d-joint-preservation/README.md) pass.
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
  [Matched noise controls](assets/12c-matched-noise/README.md) expose a strong
  attenuation/reference-distortion tradeoff. [Clean-reference and level controls](assets/12c-clean-reference/README.md)
  extend it. The user prefers the learned audition; carry RNNoise forward while
  protected phonemes, joins and broader listening remain open.
  [Transient noise](assets/12c-transient-noise/README.md) and
  [channel relations](assets/12c-channel-relations/README.md) extend measured
  coverage without selecting a stereo policy. [Range-origin evidence](assets/12c-range-origin/README.md)
  rejects a one-second warmup for exact previews; prepared outputs/checkpoints remain
  the next state mechanism to verify.
- [Stretch endpoint and guarded-join evidence](assets/13a-endpoint-verification/README.md)
  retains full-support measurements and real-speech auditions. Root integration
  reproduces all 32 renders and nine retained WAVs exactly. Listening, independent
  protected-word labels and short-input quality remain open.
  [Short-input alternatives](assets/13a-short-capability/README.md) improve one
  tone gate but worsen endpoint response; no automatic fallback is adopted.

Use isolated homes and frozen workers. Imported assets never fabricate recording
rows or narration roles; preserve physical support and acquisition provenance.
Never pad missing samples, truncate support or relax thresholds to conceal a
failure. Numerical checks cannot close listening or physical-camera acceptance.
[Early encoding trials](assets/06-pointer-encoding/README.md) isolate a scoped bitrate improvement;
the later [output quality study](assets/09b-output-quality/README.md) selects an
editable balanced default while broader appearance acceptance remains open. Remaining animation delivery (16), audio conformance/scale (08), camera (20/21),
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
- [x] [06 — Reproduce native multi-source rendering](slices/06-render-reproduction.md)
- [x] [07 — Execute video plans](slices/07-video-execution.md)
- [ ] [08 — Independent audio mixing](slices/08-audio-mixing.md)
- [x] [08a — Shared derived-file ownership](slices/08a-derived-cache.md)
- [x] [09 — First public preview and export](slices/09-first-preview.md)
- [x] [09b — Agent-controlled output settings](slices/09b-output-settings.md)
- [x] [10a — Exact source-range occurrences](slices/10a-source-range-projection.md)
- [x] [10b — Source acquisition and selected-stream transcripts](slices/10b-source-acquisition.md)
- [x] [10c — Bounded occurrence evidence and phrase search](slices/10c-occurrence-queries.md)
- [x] [10d — Direct frames and retained screenshot inspection](slices/10d-frame-inspection.md)
- [x] [10 — Occurrence-aware inspection](slices/10-project-evidence.md)
- [x] [11a — Shared source and project PCM delivery](slices/11a-audio-delivery.md)
- [ ] [11 — Audio, waveforms and spectrograms](slices/11-audio-inspection.md)
- [ ] [12 — Validate speech cleanup evidence](slices/12-speech-evidence.md)
- [ ] [12b — Adopt verified source speech processing](slices/12b-speech-processing.md)
- [ ] [12c — Reproduce local noise reduction](slices/12c-noise-reproduction.md)
- [ ] [13 — Reproduce pitch-preserving stretch](slices/13-stretch-reproduction.md)
- [ ] [13a — Preserve selected speech at stretch endpoints](slices/13a-stretch-endpoints.md)
- [x] [13b — Native stretch recipe parity](slices/13b-native-stretch-parity.md)
- [ ] [14 — Integrate independent and linked retiming](slices/14-retiming.md)
- [x] [15 — Layers, crop and pointer geometry](slices/15-layer-geometry.md)
- [ ] [14a — Durable prepared audio lifecycle](slices/14a-prepared-audio.md)
- [ ] [15a — Adopt verified noise processing](slices/15a-noise-processing.md)
- [x] [15a1 — Frozen learned native-entry parity](slices/15a1-denoise-entry-parity.md)
- [ ] [15a2 — Typed learned state and prepared consumers](slices/15a2-denoise-prepared-consumers.md)
- [x] [15a2a — Revision-owned clip state domains](slices/15a2a-state-domains.md)
- [x] [15a2b — Structural parent domains and authored activation](slices/15a2b-parent-state-windows.md)
- [x] [15a2c — State input bindings and channel provenance](slices/15a2c-state-input-bindings.md)
- [x] [15a2d — Linked mono state execution](slices/15a2d-linked-denoise-runtime.md)
- [x] [15a2e — Selected input and ordered consumer isolation](slices/15a2e-state-isolation.md)
- [x] [15a2f — Independent learned state per channel](slices/15a2f-independent-channels.md)
- [ ] [15a3 — Combined, temporal and protected-speech acceptance](slices/15a3-denoise-acceptance.md)
- [x] [15a3b — Explicit denoise strength and transitions](slices/15a3b-denoise-transitions.md)
- [x] [15a3a — Public unit-rate combined temporal processing](slices/15a3a-unit-rate-combined.md)
- [x] [16a — Scalar curve compiler prerequisite](slices/16a-curve-primitives.md)
- [x] [16b — Canonical numerical scalar program](slices/16b-scalar-program.md)
- [ ] [16 — Keyframes and convenience zooms](slices/16-keyframes.md)
- [x] [17a — Explicit font and text layout reproduction](slices/17a-text-layout.md)
- [x] [17b — Immutable font admission](slices/17b-font-admission.md)
- [x] [17c — Literal text clips](slices/17c-literal-text.md)
- [x] [17d — Occurrence-specific transcript seeding](slices/17d-transcript-seeding.md)
- [x] [17 — Text and attached captions](slices/17-text-captions.md)
- [ ] [18 — Reproduce local reference speech](slices/18-voice-reproduction.md)
- [ ] [19 — Durable local generation and replacement](slices/19-voice-assets.md)
- [x] [20a — Offline clock and separate-source plumbing](slices/20a-offline-clock.md) — offline scope; physical acceptance remains20.
- [x] [20b — Exact capture placement and accepted PCM addresses](slices/20b-exact-capture-audio.md)
- [x] [20c — Shared sparse capture materialization](slices/20c-sparse-capture-materialization.md)
- [x] [20d — Canonical capture publication and recovery rollout](slices/20d-capture-publication.md)
- [x] [20d1 — Responsive capture recovery lifecycle](slices/20d1-recovery-continuation.md)
- [x] [20d2 — Public immutable asset metadata pages](slices/20d2-asset-metadata-pages.md)
- [x] [20d3 — Inventory-bound project package JSON](slices/20d3-package-asset-metadata.md)
- [x] [20d4 — Operational source-evidence retry](slices/20d4-source-admission-retry.md)
- [x] [20d5 — Source-owned recording job controls](slices/20d5-recording-source-job-target.md)
- [x] [20d6 — Explicit settled recording cleanup](slices/20d6-settled-cleanup.md)
- [x] [20d7 — Preserve terminal capture diagnostics](slices/20d7-terminal-diagnostics.md)
- [x] [20d8 — Prerecorded pause and terminal persistence](slices/20d8-pause-terminal-boundaries.md)
- [ ] [20 — Prove screen and camera timing](slices/20-camera-reproduction.md)
- [ ] [21 — Integrate synchronized webcam capture](slices/21-webcam.md)
- [x] [22a — Portable snapshot and dependency boundary](slices/22a-portable-snapshots.md)
- [x] [22b — Retained output in project consumers](slices/22b-retained-project-consumers.md)
- [x] [22c — Complete prepared recipes in portable resources](slices/22c-prepared-recipe-budget.md)
- [x] [22 — Relocatable editable projects](slices/22-portable-projects.md)
- [ ] [23 — Cut over all consumers and remove old owners](slices/23-cutover.md)
- [ ] [24 — Verify bounded work and long projects](slices/24-scale.md)
- [x] [24a — Bounded compiled plan delivery](slices/24a-compiled-plan-delivery.md)
- [x] [24b — Active audio work and five-minute preparation](slices/24b-active-audio-work.md)
- [x] [24c — Bound independent edit append work](slices/24c-edit-batch-work.md)
- [x] [24d — One committed document in public edit receipts](slices/24d-edit-receipts.md)
- [x] [24e — Compact public job recipe identity](slices/24e-job-status.md)
- [x] [24f — Successful long learned preparation](slices/24f-successful-learned-scale.md)
- [x] [24g — Bounded fragmented-source selections](slices/24g-fragmented-selection.md)
- [x] [24h — Bounded public job inspection](slices/24h-job-inspection.md)
- [x] [24i — Independent processing batches](slices/24i-processing-batches.md)
- [ ] [24j — Complete two-hour prepared-package transfer](slices/24j-prepared-package-scale.md)
- [x] [24k — Routed placement and bounded queued reads](slices/24k-routing-scale.md)
- [x] [24l — Warm1080p preview budget](slices/24l-preview-budget.md)
- [x] [24m — Query memory across doubled timeline duration](slices/24m-query-duration-memory.md)
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
