# Agent-operated video editing

Status: implementation in progress; assets and shared preparation jobs verified in the isolated service, structural edits, stack authoring and durable public project state/deletion verified; native composition rendering and public preview integrated. Updated 2026-09-30.
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
verified public operations; the installed app has not switched engines.

Current pickup is [15a3 post-retime processing](slices/15a3-denoise-acceptance.md),
with [acoustic retime conformance11](assets/11-retimed-acoustic/README.md) verified. Public14 retiming and16
animated gain/zoom are verified, including complete encoded-frame checks and muted
offscreen playback. The [preserve-pitch combined denoise join](assets/15a3c-post-retime-combined/root-verification.json)
passes independent PCM and matched full/range AAC checks. Continue the narrow
follow-pitch learned check against retained14d evidence, then resolve remaining
speech/denoise quality gates. Numerical evidence never substitutes for hearing.

Reuse [retiming acceptance](assets/14e-public-retiming/root-review.md),
[retimed curves](assets/16-retimed-curves/root-verification.json) and
[playback evidence](assets/16-continuous-playback/README.md). Preserve full retained
runs across splits and short views; use existing preparation owners.

Use [implementation pickup](assets/implementation-pickup.md) for active worktrees,
prepared runtimes and frozen worker identities. Do not replace the installed app
or frozen workers. Build native changes only in isolated scratch paths. No new
capture is authorized; originals remain in the [camera fixtures](../../fixtures/screen-camera-timing/README.md).

Resolve remaining speech/denoise gates toward12b/15a and the
dependent16 checks; then physical20→21, final23 cutover, post-cutover24 scale and25
autonomous workflow. The checklist is authoritative; the overview diagram is not
a scheduling graph. Further12b/19/23 consumer acceptance retains its missing quality or physical
prerequisite. Do not repeat
passed cohorts instead of resolving those requirements.

[Integrated evidence](assets/integrated-evidence.md) is the compact index for
verified preservation, processing, transfer, capture replay and scale checkpoints.
Their owning slices retain limitations. In particular, prerecorded camera
recovery/stop evidence does not establish the physical one-frame timing bound,
whole-take coverage or live shutdown; installed cutover stays unverified.

Listening comparisons use complete meaningful sentences from the user's recording,
with the original alongside and one clear purpose. The user accepted the familiar
0.8×,0.9× and1.25× sentences (slight0.9× echo tolerated), the corrected A–D local
selections, the familiar denoised sentence and the complete-sentence filler cut.
Each verdict applies only to its exact media. Reuse those passes; numerical parity
does not replace missing listening or physical evidence. Room-tone fill and noise
reduction remain independent explicit editorial choices, as the [pause workflows](assets/pause-audio-public/README.md)
demonstrate. Segmentation remains a separate future placeholder.

Keep this pickup, the owning Status lines, [journeys](journeys.md) and checklist
current as implementation progresses.

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
and precise operations; [editorial control](architecture.md#editorial-control)
keeps practical judgment in the agent and user. References may come from current footage, any admitted
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
- [x] [08 — Independent audio mixing](slices/08-audio-mixing.md)
- [x] [08a — Shared derived-file ownership](slices/08a-derived-cache.md)
- [x] [09 — First public preview and export](slices/09-first-preview.md)
- [x] [09b — Agent-controlled output settings](slices/09b-output-settings.md)
- [x] [10a — Exact source-range occurrences](slices/10a-source-range-projection.md)
- [x] [10b — Source acquisition and selected-stream transcripts](slices/10b-source-acquisition.md)
- [x] [10c — Bounded occurrence evidence and phrase search](slices/10c-occurrence-queries.md)
- [x] [10d — Direct frames and retained screenshot inspection](slices/10d-frame-inspection.md)
- [x] [10 — Occurrence-aware inspection](slices/10-project-evidence.md)
- [x] [11a — Shared source and project PCM delivery](slices/11a-audio-delivery.md)
- [x] [11 — Audio, waveforms and spectrograms](slices/11-audio-inspection.md)
- [ ] [12 — Validate speech cleanup evidence](slices/12-speech-evidence.md)
- [ ] [12b — Adopt verified source speech processing](slices/12b-speech-processing.md)
- [ ] [12c — Reproduce local noise reduction](slices/12c-noise-reproduction.md)
- [ ] [12d — Complete sentence cleanup annotation packet](slices/12d-complete-sentence-cleanup.md)
- [x] [13 — Reproduce pitch-preserving stretch](slices/13-stretch-reproduction.md)
- [x] [13a — Preserve selected speech at stretch endpoints](slices/13a-stretch-endpoints.md)
- [x] [13b — Native stretch recipe parity](slices/13b-native-stretch-parity.md)
- [x] [14 — Integrate independent and linked retiming](slices/14-retiming.md)
  - [x] [14b — Retained-run native preparation](slices/14b-retained-retime-preparation.md)
  - [x] [14c — Linked stereo stretch](slices/14c-stereo-stretch.md)
  - [x] [14d — Explicit pitch follow](slices/14d-pitch-follow.md)
  - [x] [14e — Public retiming delivery](slices/14e-public-retiming.md)
  - [x] [14f — Exact picture sampling](slices/14f-exact-picture-sampling.md)
- [x] [15 — Layers, crop and pointer geometry](slices/15-layer-geometry.md)
- [x] [14a — Durable prepared audio lifecycle](slices/14a-prepared-audio.md)
- [ ] [15a — Adopt verified noise processing](slices/15a-noise-processing.md)
- [x] [15a1 — Frozen learned native-entry parity](slices/15a1-denoise-entry-parity.md)
- [x] [15a2 — Typed learned state and prepared consumers](slices/15a2-denoise-prepared-consumers.md)
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
- [x] [16 — Keyframes and convenience zooms](slices/16-keyframes.md)
- [x] [17a — Explicit font and text layout reproduction](slices/17a-text-layout.md)
- [x] [17b — Immutable font admission](slices/17b-font-admission.md)
- [x] [17c — Literal text clips](slices/17c-literal-text.md)
- [x] [17d — Occurrence-specific transcript seeding](slices/17d-transcript-seeding.md)
- [x] [17 — Text and attached captions](slices/17-text-captions.md)
- [ ] [18 — Reproduce local reference speech](slices/18-voice-reproduction.md)
- [x] [18a — Frozen voice repeatability across fresh processes](slices/18a-voice-repeatability.md)
- [ ] [19 — Durable local generation and replacement](slices/19-voice-assets.md)
- [x] [19a — Frozen voice worker entry parity](slices/19a-voice-entry-parity.md)
- [x] [19b — Relocatable prepared voice runtime](slices/19b-voice-runtime-relocation.md)
- [x] [19c — Common local model preparation](slices/19c-common-model-preparation.md)
- [x] [19d — Measured voice settings and bounded work](slices/19d-voice-settings.md)
- [x] [19d1 — Nonempty probability-filter support](slices/19d1-probability-filter.md)
- [x] [19e1 — Canonical finite audio conversion](slices/19e1-finite-audio-conversion.md)
- [x] [19e — Retained audio excerpts](slices/19e-retained-audio-excerpts.md)
- [x] [19f — Public durable voice generation](slices/19f-public-voice-jobs.md)
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
- [x] [20e — Prepare selected-device clock reproduction](slices/20e-selected-device-probe.md)
- [x] [20e1 — Durable camera gap materialization](slices/20e1-camera-gap-materialization.md)
- [x] [20e2 — Ordered camera acquisition and native display support](slices/20e2-camera-presentation.md)
- [ ] [21 — Integrate synchronized webcam capture](slices/21-webcam.md)
- [x] [22a — Portable snapshot and dependency boundary](slices/22a-portable-snapshots.md)
- [x] [22b — Retained output in project consumers](slices/22b-retained-project-consumers.md)
- [x] [22c — Complete prepared recipes in portable resources](slices/22c-prepared-recipe-budget.md)
- [x] [22 — Relocatable editable projects](slices/22-portable-projects.md)
- [ ] [23 — Cut over all consumers and remove old owners](slices/23-cutover.md)
- [x] [23a — Retained recording to identity-project preservation](slices/23a-recording-project-preservation.md)
- [x] [23b — Matched export recovery preservation](slices/23b-export-recovery-preservation.md)
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
- [x] [24j — Complete two-hour prepared-package transfer](slices/24j-prepared-package-scale.md)
- [x] [24k — Routed placement and bounded queued reads](slices/24k-routing-scale.md)
- [x] [24l — Warm1080p preview budget](slices/24l-preview-budget.md)
- [x] [24m — Query memory across doubled timeline duration](slices/24m-query-duration-memory.md)
- [x] [24n — Actual decoder and descriptor work accounting](slices/24n-decoder-work.md)
- [x] [24o — Immediately available descriptor metadata](slices/24o-descriptor-metadata.md)
- [x] [24p — Inherited audio container identification](slices/24p-audio-format-admission.md)
- [x] [24q — Finite native decoder demand](slices/24q-finite-decoder-demand.md)
- [x] [24r — Bounded public history queries](slices/24r-history-query-scale.md)
- [x] [24s — Retained audio streaming deadline](slices/24s-audio-stream-budget.md)
- [x] [24t — Retired source-job reference history](slices/24t-job-reference-retirement.md)
- [x] [24u — Combined document and retained-history transfer](slices/24u-package-history-scale.md)
- [x] [24v — Learned processing through deep/wide routing](slices/24v-learned-routing-scale.md)
- [x] [24w — Bounded waveform queries across duration](slices/24w-waveform-duration-memory.md)
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
