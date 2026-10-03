# Agent-operated video editing

Status: implementation in progress; assets and shared preparation jobs verified in the isolated service, structural edits, stack authoring and durable public project state/deletion verified; native composition rendering and public preview integrated. Updated 2026-10-03.
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

The product supplies primitives and makes zero editorial decisions. Implement
through the existing [contracts](contracts.md), [architecture](architecture.md)
and [processing owner](processing.md); the consumer
[screenrec skill](../../skills/screenrec/SKILL.md) is for the external caller.

**Next pickup: the reviewed personal release.** The
[production PNG adoption bank](assets/23-owner-fixture-ports/current-production-png-verification.json)
now reproduces all fourteen saved requests with exact receipt, complete pixel
and encoded-PNG equality. Reuse that result and the existing visual review;
no further rendering, build or public edit replay follows from adoption.

The [canonical registry](assets/23-owner-fixture-ports/README.md) owns current
results and exact limitations. Reuse the passed long learned-processing bank,
combined scale, current pointer/trail, cancellation and muted-player banks.
The [fresh installed caller](slices/25d-installed-caller.md) now passes default
CLI/MCP discovery, edit/replay/refusal/delivery and retained-package continuity;
do not repeat the thirteen-effect source workflow. The
[fresh saved visual review](assets/25b-fresh-caller/fresh-visual-review/README.md)
and [model-path audit](assets/25-installed-model-paths/README.md) have separate
sampled and source-only verdicts.

Review the [personal release plan](assets/acceptance-maintenance/personal-release-plan.json):
exact candidate identity, old app/library/preferences preservation, fresh
format23 state, rollback and named post-switch measurement. Private installation is not personal
replacement. Current format23 refuses prior catalogs without migration or byte
mutation; preserve the personal installation until the reviewed switch.

| Owner | Remaining acceptance |
| --- | --- |
| [12 speech](slices/12-speech-evidence.md) | Broader independent acoustic/reference coverage, joins/listening and warm resources |
| [20 / 21 capture](slices/21-webcam.md#implementation-graph) | Physical uncertainty/synchronization and broader lifecycle scope |
| [23 cutover](slices/23-cutover.md) | Broader presentation/listening and personal switching |
| [24 scale](slices/24-scale.md) | Known heavy-build contention and final production installed measurement |
| [25 caller](slices/25-agent-acceptance.md) | Personal replacement and full release scope |

The implementation-end repository run has already occurred. Reuse matched
passes and repair invalidated or unmatched contracts; focused recovery is not a
full green run. The storage deadline under heavy native compilation waits for an
independently required build; do not manufacture load or repeat a cached build.

No new recording is queued. Reuse [sustained Stop/quit](assets/20-sustained-physical-stop/verification-confirmation/README.md),
[saved recovery](assets/20-sustained-physical-stop/acquisition-recovery/README.md)
and [encoded picture binding](assets/20-camera-picture-correspondence/encoded-binding/README.md).
[Retained marker analysis](assets/20-retained-marker-resolution/README.md) reached
its stopping condition; ordinal association is not physical timing proof.
The [speech audit](assets/acceptance-maintenance/speech-readiness.md) and
[reference-access qualification](assets/acceptance-maintenance/speech-reference-access.json)
own the stopped acoustic campaign. Do not repeat corpus searches, inference,
read-sentence trials or publisher/license submissions. Reuse saved human marks,
accepted auditions and the selected200ms ambience; the250ms version is rejected.

Follow [project principles](../../AGENTS.md): narrow checks, unchanged-output
reuse, isolated state and preserved originals. Keep owning Status lines and this
pickup consistent. Unmeasured acceptance stays explicit; no extra editorial work
or indefinite evidence campaign follows from it.

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

## What counts as success

The toolkit is successful when an external caller can discover evidence, express
an explicit operation, inspect its result and undo or export it reliably. It is
not graded on independently deciding how a recording should be edited.

| Responsibility | Owner | What verification establishes |
| --- | --- | --- |
| Recognized words, timing estimates, repeated occurrences and surrounding media | Toolkit evidence primitives | Accurate provenance, inspectable omissions and measured uncertainty; a label is not a removal instruction. |
| Which occurrence to keep/remove, desired pacing, replacement wording and treatments | External caller acting on the user's request | The caller's brief supplies intent; repository tests supply explicit fixture targets. |
| Cuts, processing, composition, preview/export and history | Toolkit execution primitives | Only the requested operation occurs, protected content and originals survive, and failures/replay/undo remain truthful. |

Keep broad composition capabilities in scope: zero editorial decisions does not
restrict this to filler removal. Conversely, an ambitious caller workflow does
not authorize an embedded editor, an automatic cleanup pipeline or a development
assignment to polish the user's recording. Accepted audition preferences describe
their exact fixtures, not global engine defaults.

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
- [x] [09c — Audio-only export](slices/09c-audio-only-export.md) — scoped public implementation and both original deadline checks pass; general performance and installed acceptance remain required under 24/25
- [x] [10a — Exact source-range occurrences](slices/10a-source-range-projection.md)
- [x] [10b — Source acquisition and selected-stream transcripts](slices/10b-source-acquisition.md)
- [x] [10c — Bounded occurrence evidence and phrase search](slices/10c-occurrence-queries.md)
- [x] [10d — Direct frames and retained screenshot inspection](slices/10d-frame-inspection.md)
- [x] [10 — Occurrence-aware inspection](slices/10-project-evidence.md)
- [x] [11a — Shared source and project PCM delivery](slices/11a-audio-delivery.md)
- [x] [11 — Audio, waveforms and spectrograms](slices/11-audio-inspection.md)
- [ ] [12 — Validate speech-evidence primitives](slices/12-speech-evidence.md)
- [x] [12h — Unchanged retained-sentence recognition](slices/12h-retained-sentence-recognition.md) — one case banked; timing fails and parent 12 remains open
- [x] [12j — Independent utterance lexical diagnostic](slices/12j-external-lexical-diagnostic.md) — full bounded source/results qualified; broader timing/listening/held-out remain open
- [x] [12k — Independent manual-word timing](slices/12k-independent-word-timing.md) — one whole manually marked example, numerical thresholds met; full evaluation pending and original timeout separate
- [x] [12l — Independent supplied-text timing](slices/12l-independent-supplied-text-timing.md) — one whole example improves numerical timing; full evaluation pending, no adoption
- [x] [12i — Retained-sentence supplied-text alignment](slices/12i-retained-sentence-alignment.md) — numerical case qualified separately from original producer inventory failure; parent 12 remains open
- [x] [12g — Evaluator best-effort filler policy](slices/12g-evaluator-policy.md) — scorer contract only; parent speech quality remains open
- [x] [12b — Adopt verified source speech processing](slices/12b-speech-processing.md)
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
- [x] [20f — Qualified camera publication scheduling](slices/20f-camera-publication-overlap.md) — scoped preservation and qualified interrupted-prefix fallback pass; retained-take adoption/performance remain open
- [x] [20g — Raw camera prefix feasibility](slices/20g-camera-raw-prefix.md) — experiment concluded with mixed evidence; one-picture-tail hypothesis rejected, superseded by20h/20m qualification; no physical acceptance claim
- [x] [20h — Complete-IDR raw camera fence](slices/20h-camera-idr-fence.md) — two fixed prefix cases pass; exceptional timeout cleanup remains unqualified
- [x] [20i — Independent growing canonical MOV](slices/20i-growing-canonical-feasibility.md) — fixed intact-buffer prefix/closure and all197 correspondence pass; live production/backlog/recovery/stop remain open
- [x] [20j — Resume decoded camera verification](slices/20j-camera-range-digests.md) — fixed ranges and both continuing digest projections pass;20m supplies production lifetime and retained-stop proof
- [x] [20k — Cursor-bounded compressed camera samples](slices/20k-camera-cursor-buffers.md) — stored native bytes/clocks/format pass; full-reader boundary differences retained
- [x] [20l — Unchanged cursor-sample camera transfer](slices/20l-camera-cursor-transfer.md) — fixed active-prefix/full-output proof;20m supplies production adoption and retained-stop proof
- [x] [20m — Continuing camera verification in the publication owner](slices/20m-camera-continuing-verification.md) — retained prerecorded sustained advancement and 6.683-second durable stop; physical lifecycle remains with parents20/21
- [ ] [21 — Integrate synchronized webcam capture](slices/21-webcam.md)
- [x] [21a — Public camera discovery and permission facts](slices/21a-camera-discovery.md)
- [x] [21b — Closed camera sources and retryable publication](slices/21b-camera-source-publication.md)
- [x] [21c — Selected camera input through the shared lifecycle](slices/21c-selected-camera-input.md)
- [x] [21d — Durable adoption of independent captured sources](slices/21d-captured-source-adoption.md)
- [x] [21e — Caller-authored projects from captured sources](slices/21e-capture-project-adoption.md)
- [x] [21f — Complete public selected-camera integration](slices/21f-public-camera-selection.md)
  - [x] [21f1 — Durable capture facts independent of editing](slices/21f1-capture-facts.md)
  - [x] [21f2 — Fresh-service capture coordination](slices/21f2-capture-coordination.md)
    - [x] [21f2a — Durable deferred capture admission](slices/21f2a-capture-admission.md)
  - [x] [21f3 — Atomic public camera selection](slices/21f3-public-camera-selection.md)
    - [x] [21f3a — Independent closed-source publication](slices/21f3a-independent-publication.md)
    - [x] [21f3b — Camera support without primary pictures](slices/21f3b-independent-camera-clock.md)
    - [x] [21f3c — Native crash-source publication recovery](slices/21f3c-source-publication-recovery.md)
- [x] [22a — Portable snapshot and dependency boundary](slices/22a-portable-snapshots.md)
- [x] [22b — Retained output in project consumers](slices/22b-retained-project-consumers.md)
- [x] [22c — Complete prepared recipes in portable resources](slices/22c-prepared-recipe-budget.md)
- [x] [22 — Relocatable editable projects](slices/22-portable-projects.md)
- [ ] [23 — Cut over all consumers and remove old owners](slices/23-cutover.md)
- [x] [23a — Retained recording to identity-project preservation](slices/23a-recording-project-preservation.md)
- [x] [23b — Matched export recovery preservation](slices/23b-export-recovery-preservation.md)
- [x] [23c — Isolated project-library storage preservation](slices/23c-project-storage.md)
- [x] [23d — Native export status and discovery parity](slices/23d-export-consumer-parity.md)
- [x] [23e — Native preview receipt and lease parity](slices/23e-preview-consumer-parity.md)
- [x] [23f — Captured-source lifetime and cleanup](slices/23f-capture-source-lifetime.md)
- [x] [23g — Explicit native project export requests](slices/23g-project-export-requests.md)
- [x] [23h — Native library consumption](slices/23h-native-library-consumption.md)
- [x] [23i — App-owned project-service process](slices/23i-service-process-parity.md)
- [x] [23j — Paired public edit-state preservation](slices/23j-state-preservation.md) — complete public state/interval/history correspondence; historical MCP adapter exits remain unverified
- [x] [23k — Source metadata and composed native consumers](slices/23k-source-consumer-bridge.md) — actual pagination/dispatch and distinct historical readiness consumption
- [ ] [23l — Paired public edited frames](slices/23l-paired-edited-frames.md) — joins/final support/default delivery verified; all saved references now match complete production-worker pixels and PNGs; personal installed/default-library acceptance remains separate
- [x] [23l1 — Fixed-image composition stage boundary](slices/23l1-image-color-stages.md) — diagnostic complete; historical decoder cause remains open
- [x] [23l2 — Project PNG publication](slices/23l2-project-png-publication.md) — fixed-image and all fourteen saved native video PNGs verified; installed adoption and full movie parity remain open
- [x] [23m — Paired partial words and absent acquisition role](slices/23m-paired-partial-words-and-absent-role.md) — complete public partial/absent-role proof; quality remains open and positive system has separate 23o proof
- [x] [23n — Registered transcription-model readiness](slices/23n-parakeet-model-readiness.md) — genuine readiness and separate merged failure controls pass
- [x] [23o — Positive system package/project correspondence](slices/23o-system-package-correspondence.md) — authored public fixture, complete PCM/hole/split proof; automatic export/live/installed scope stays open
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
- [x] [24z — Source-selection cardinality](slices/24z-source-cardinality.md)
- [x] [24z1 — Fresh source metadata batches](slices/24z1-source-metadata-resolution.md) — scoped functional/work proof; latency remains under 24z
- [x] [24z2 — Unique prepared-input retention and one admission composition](slices/24z2-prepared-admission.md) — bounded work/lifecycle; later 24z4 passes the original deadline
- [x] [24z3 — Canonical native PCM admission capacity](slices/24z3-prepared-capacity.md) — supported queue/refused next frame; no large output claim
- [x] [25a — Registered voice readiness](slices/25a-model-readiness.md) — isolated public preparation/reopen; generation and full caller acceptance separate
- [x] [24z4 — Per-window resource bindings](slices/24z4-prepared-bindings.md) — full merged prepared suite and public WAV; original large deadline passes
- [x] [24z5 — Asset presence at service boundaries](slices/24z5-service-asset-presence.md) — full merged service suite/public WAV; original diagnostic deadline passes
- [x] [24z6 — Mixed composition append runs](slices/24z6-composition-appends.md) — scalar receipts/errors and bounded work; full project-evidence deadlines pass
- [x] [24z7 — Read-only scene-event source resolution](slices/24z7-source-event-resolution.md) — fresh metadata phases and exact consumer output; merged consumer groups pass
- [x] [24z8 — Demanded source-frame support](slices/24z8-source-frame-support.md) — bounded native payload, full support authority and public/frozen-native parity
- [x] [24z9 — One complete source-index plan per call](slices/24z9-source-index-plan-resolution.md) — fresh request/execution and full delivery work proof; original whole-setup relocation timeout retained, later scoped check passes in 24z10
- [x] [24z10 — Portable relocation test boundary](slices/24z10-portable-index-relocation.md) — unchanged fixture/durability, complete values and merged checks; no product/whole-setup speedup
- [x] [24z11 — Complete operation-result MCP delivery](slices/24z11-operation-result-delivery.md) — full default-client reconstruction and merged 126/126; original deadline failures retained
- [x] [24z12 — Complete MCP media-envelope admission](slices/24z12-mcp-media-admission.md) — merged140 consumer gate; whole-batch deferral before consumption, with complete metadata/live tokens
- [x] [24z13 — CLI delivery retains service selection](slices/24z13-cli-delivery-selection.md) — merged84 consumer checks; no rediscovery or operation replay during delivery
- [x] [25b — Fresh source-caller workflow](slices/25b-fresh-caller.md) — complete controlled brief; parent installed/release/listening/physical gates remain open
- [x] [25c — Independent source MCP caller](slices/25c-source-mcp-caller.md) — compact source checkpoint; installed/release acceptance separate
- [x] [25d — Fresh installed caller checkpoint](slices/25d-installed-caller.md) — bounded private installation and retained-package bridge; personal replacement/full release separate
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
  before their adoption. A failed gate stays open. Further research requires the
  bounded justification in verification; it does not automatically trigger another model,
  tuning trial or human task.
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
the remaining camera seams. The [feedback maintenance review](assets/planning/feedback-maintenance.json)
reconciles the current handoff and accepted results. These document checks are
distinct from runtime acceptance.

The [crash-source recovery review](assets/planning/camera-recovery-maintenance.json)
records the native authority prerequisite and its staged admission contract.
It preserves completed-source checks and original journals without adding an
editorial policy or claiming physical acceptance.
