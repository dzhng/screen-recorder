# Agent-operated video editing

Status: implementation in progress; assets and shared preparation jobs verified in the isolated service, structural edits, stack authoring and durable public project state/deletion verified; native composition rendering and public preview integrated. Updated 2026-10-01.
Product boundary: **zero editorial decisions; only primitives**. The external
agent using this project makes every editorial decision. Follow the
[editorial-control contract](architecture.md#editorial-control) when interpreting
any workflow, experiment or acceptance gate below.
The [product CLI skill](../../skills/screenrec/SKILL.md) documents current public
capabilities for the external caller only. This plan supersedes the discovery map's operational queue;
the [map](MAP.md) and [processing map](PROCESSING-MAP.md) record user intent.
[Ordered processing](processing.md) owns the accepted one-stack-per-target API.
[Reference-style audit](assets/reference-style/README.md) maps the user’s new video
example to the plan; the user kept segmentation outside this run and requested a
[generalized video-segmentation placeholder](../video-segmentation/README.md).

## Next Agent Prompt

Implement the remaining toolkit primitives through the existing owners. Read
[contracts](contracts.md), [architecture](architecture.md),
[verification](verification.md), [journeys](journeys.md) and [processing](processing.md).
The external agent using the toolkit makes every editorial decision. The consumer
skill is a product artifact, not this repository's development workflow.

**Next pickup: [21f selector-free admission and coordinator integration](slices/21f-public-camera-selection.md#implementation-checkpoints).**
[21e caller-authored projects](slices/21e-capture-project-adoption.md) is integrated
and merged-verified: explicit composition, independent media replacement/undo and
donor-free portable history pass. All merged PNG/WAV bytes match its reviewed
fixture packet; physical synchronization and representative image quality remain
separate claims.
[21d source admission](slices/21d-captured-source-adoption.md) is verified through
current native, public retry/restart and portable paths; its actual retained-take
check preserves historical scope. [21c selected input](slices/21c-selected-camera-input.md)
and [21b closed sources/publication](slices/21b-camera-source-publication.md) pass
controlled NativeCapture. The [remaining 21 graph](slices/21-webcam.md#implementation-graph)
separates source proof/binding, caller-authored project integration and public exposure.
[21a passive discovery](slices/21a-camera-discovery.md) is verified in its controlled
scope. Public camera-start selectors remain rejected until their complete path is
ready. Capture publishes source facts; the caller supplies canvas, tracks, placement
and links through existing project/edit operations. It receives no automatically
chosen composition.

[21f1 capture-facts extraction](slices/21f1-capture-facts.md) is integrated and
merged-verified. Next in that branch is selector-free fresh-service coordinator
wiring and durable source-admission facts; camera selection remains rejected.
Installed span transactions remain intact until the explicit cutover in 23.
[23d native export consumption](slices/23d-export-consumer-parity.md) is integrated
and merged-verified for recording/project receipts and truthful failure recovery.
Remaining consumer ports and installed switching remain under 23.

For [12b](slices/12b-speech-processing.md), preserve the selected Parakeet baseline
and its disclosed best-effort fillers/timing limits. [Controlled public integration](assets/12b-public-parity/README.md)
and [actual selected-source inference parity](assets/12b-public-parity/actual-inference/README.md)
pass requests, complete raw outputs, provenance, generations and explicit fixture
edits through existing owners. Verified personal model files remain unchanged;
scratch readiness is declared and current generic preparation-owner readiness
remains open. Broader acoustic/lexical quality and any alternative recipe keep
their own evidence gates. Do not repeat the accepted parity cohort or require a
new ASR winner or personal keep/remove answer first.

Work the independent branches below in parallel when their implementation seams
are ready. Acceptance dependencies do not prohibit isolated preparation.

| Remaining owner | Next permitted work | Claim that remains open |
| --- | --- | --- |
| [12 / 12b](slices/12-speech-evidence.md) | Reuse completed baseline parity; investigate only a named remaining evidence-quality question; alternate adoption only if justified | Broader acoustic coverage/timing, held-out quality and any alternate recipe |
| [20 / 21](slices/20-camera-reproduction.md) | Selector-free durable admission and coordinator wiring, then atomic public selection; retained data only for a named unresolved timing question | Public selection waits for its complete path; one-frame physical sync, live interruption/pause/shutdown and stop completion remain open |
| [23](slices/23-cutover.md) | Remaining matched consumer ports and preservation checks | Installed switching and obsolete-owner removal after their actual prerequisites |
| [24 / 25](slices/24-scale.md) | [Source-cardinality attribution](slices/24z-source-cardinality.md) with a separately pinned runtime, remaining dimensions and the [prepared caller fixture brief](assets/25-fixture-brief/README.md) | Contended timing is not an isolated result; final budgets and installed caller acceptance remain open |

The retained camera is 246 seconds and screen about 251 seconds. It already meets the
user's requested take duration. The current coarse analysis validates only a
shorter camera-marker interval; duration is not the missing input. Use existing
originals, journals, recovered media and event telemetry before considering any
new recording. The [finer retained-data diagnostic](assets/20-retained-marker-resolution/README.md)
adds candidate visibility and clock-coordinate evidence, with physical onset
and event identity limits preserved. [20](slices/20-camera-reproduction.md) owns
the measurement question,
uncertainty and stopping condition. Never request a routine replacement tutorial.

Preserve [banked evidence](assets/integrated-evidence.md), including 12d/12e/12f,
retiming, denoise, local voice and the chosen 200 ms speech-free ambience loop with
its user-tolerated slight seam. Do not repeat accepted auditions/marking, retune
that loop or borrow one file's verdict for changed output. The retired repetition
intent solicitation stays retired. Missing technical evidence stays unverified;
failed scores and deadlines do not become passes through a plan rewrite.

Use [implementation pickup](assets/implementation-pickup.md) for source/runtime
identities and isolated homes. No new capture, audible playback, model installation
or download, Claude run, frozen-worker replacement or installed-app switch is
authorized. Isolated source changes and bounded verification may proceed within
those constraints. Ask only for a concrete missing fact or separately required
live action after exhausting existing evidence; explain exactly what it would
establish and why the retained material cannot establish it.

Keep the checklist and owning Status lines current. Preparation, technical parity,
quality measurements and release acceptance are distinct results. A passed child
packet is not a full-product pass, and an open diagnostic is not an automatic
blocker for unrelated primitive implementation.

## Outcome and boundaries

The toolkit supplies recording, evidence, composition and media-processing
primitives for an external agent acting on a user's request. The caller selects
source occurrences and exact ranges, submits cuts or retiming, inserts or overlaps
footage, replaces either media plane, authors music/text/captions/keyframes, and
requests local speech generation, preview and export. Deciding that a filler,
repetition or passage should change belongs entirely to that caller. Optional ordered
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
| Give agents reliable evidence | Every repeated/reordered word/event, waveform/spectrogram, full audio delivery and verified speech-evidence primitives | 10–12b |
| Full composition | Ordered processing, retiming, presenter layers, keyframes, captions and local generated speech | 14–19 |
| Record and carry projects | Separate synchronized webcam, durable dependencies and editable relocated packages | 20–22 |
| One production engine | Cutover with preservation parity, scale checks and autonomous real-agent acceptance | 23–25 |

Numbers identify contracts, not a mandatory serial order. Dependencies in each
slice are authoritative. Research branches run early, with production adoption
only after their recorded gates pass.

The remaining **release acceptance** order is public speech parity and camera
acceptance → one-engine cutover → final production scale → external-caller
acceptance. Isolated camera integration, speech parity, consumer preservation and
remaining scale diagnosis may proceed in parallel from their verified owners.
Research into a replacement speech recipe is conditional; it must not silently
become a dependency of preserving the selected baseline. The slice files distinguish
implementation readiness from acceptance prerequisites.

## Global checklist

- [x] [00 — Freeze fixtures and preservation evidence](slices/00-corpus.md)
- [x] [01 — Composition identity and time](slices/01-composition.md)
- [x] [02a — Shared durable preparation targets](slices/02a-preparation-jobs.md)
- [x] [02 — Immutable asset admission](slices/02-assets.md)
- [x] [03a — Preserve exact edit boundaries](slices/03a-exact-edit-boundaries.md)
- [x] [03d — Preserve exact admitted media support](slices/03d-exact-media-admission.md)
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
- [ ] [12 — Validate speech-evidence primitives](slices/12-speech-evidence.md)
- [ ] [12b — Adopt verified source speech processing](slices/12b-speech-processing.md)
- [x] [12c — Reproduce local noise reduction](slices/12c-noise-reproduction.md)
- [x] [12d — Complete sentence cleanup annotation packet](slices/12d-complete-sentence-cleanup.md)
- [x] [12e — Remove the independently marked fillers](slices/12e-human-labeled-cleanup.md)
- [x] [12f — Independently identify the workbench boundary](slices/12f-workbench-boundary.md)
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
- [x] [15a — Adopt verified noise processing](slices/15a-noise-processing.md)
- [x] [15a1 — Frozen learned native-entry parity](slices/15a1-denoise-entry-parity.md)
- [x] [15a2 — Typed learned state and prepared consumers](slices/15a2-denoise-prepared-consumers.md)
- [x] [15a2a — Revision-owned clip state domains](slices/15a2a-state-domains.md)
- [x] [15a2b — Structural parent domains and authored activation](slices/15a2b-parent-state-windows.md)
- [x] [15a2c — State input bindings and channel provenance](slices/15a2c-state-input-bindings.md)
- [x] [15a2d — Linked mono state execution](slices/15a2d-linked-denoise-runtime.md)
- [x] [15a2e — Selected input and ordered consumer isolation](slices/15a2e-state-isolation.md)
- [x] [15a2f — Independent learned state per channel](slices/15a2f-independent-channels.md)
- [x] [15a3 — Combined, temporal and protected-speech acceptance](slices/15a3-denoise-acceptance.md)
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
- [x] [18 — Reproduce local reference speech](slices/18-voice-reproduction.md)
- [x] [18a — Frozen voice repeatability across fresh processes](slices/18a-voice-repeatability.md)
- [x] [19 — Durable local generation and replacement](slices/19-voice-assets.md)
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
- [x] [21a — Public camera discovery and permission facts](slices/21a-camera-discovery.md)
- [x] [21b — Closed camera sources and retryable publication](slices/21b-camera-source-publication.md)
- [x] [21c — Selected camera input through the shared lifecycle](slices/21c-selected-camera-input.md)
- [x] [21d — Durable adoption of independent captured sources](slices/21d-captured-source-adoption.md)
- [x] [21e — Caller-authored projects from captured sources](slices/21e-capture-project-adoption.md)
- [ ] [21f — Complete public selected-camera integration](slices/21f-public-camera-selection.md)
  - [x] [21f1 — Durable capture facts independent of editing](slices/21f1-capture-facts.md)
- [x] [22a — Portable snapshot and dependency boundary](slices/22a-portable-snapshots.md)
- [x] [22b — Retained output in project consumers](slices/22b-retained-project-consumers.md)
- [x] [22c — Complete prepared recipes in portable resources](slices/22c-prepared-recipe-budget.md)
- [x] [22 — Relocatable editable projects](slices/22-portable-projects.md)
- [ ] [23 — Cut over all consumers and remove old owners](slices/23-cutover.md)
- [x] [23a — Retained recording to identity-project preservation](slices/23a-recording-project-preservation.md)
- [x] [23b — Matched export recovery preservation](slices/23b-export-recovery-preservation.md)
- [x] [23c — Isolated project-library storage preservation](slices/23c-project-storage.md)
- [x] [23d — Native export status and discovery parity](slices/23d-export-consumer-parity.md)
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
- [x] [24x — Bounded evidence continuations](slices/24x-evidence-continuations.md)
- [x] [24y — Populated source-event duration](slices/24y-source-event-duration.md)
- [ ] [24z — Source-selection cardinality](slices/24z-source-cardinality.md)
- [ ] [25 — External-caller primitive acceptance](slices/25-agent-acceptance.md)

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
checks the expanded graph and local links after implementation reslicing. The
[camera maintenance review](assets/planning/camera-maintenance.json) validates
the remaining camera seams. These document checks are distinct from runtime acceptance.
