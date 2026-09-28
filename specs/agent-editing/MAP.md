# Agent-operated video editing — discovery map

Status: discovery map complete, 2026-09-27. The [implementation spec](README.md)
now supersedes this map's research queue and next prompt. OPEN findings below are
historical discovery entries with concrete owners in that spec, not a competing
task list or a claim of shipped capabilities.

## Current pickup

Read the [spec handoff](README.md#next-agent-prompt) and start at slice 00. Keep this
map as user-decision rationale; operational status and research ownership live in
the spec. Do not infer unlimited feature parity from the ambition to replace other
editors. The root-level CLI skill remains the only implemented discovery deliverable.

## Known knowns

The customer reference is [Riley Brown's request for an open, agent-native
Descript](https://x.com/rileybrown/status/2103889350354145698). Its relevant
need is direct external-agent control of recording and editing, including
transcript cuts, overlays, B-roll, and zooms, without mandatory delegation to an
embedded paid agent. The post text was recovered through the FXTwitter API
after the original URL refused automated access.

The current [CLI](../../apps/cli/README.md) already exposes shared recording,
inspection, editing, and export operations. The [protocol registry](../../packages/protocol/src/operations.ts)
owns the actual supported operations. The current
[timeline](../../packages/core/src/timeline.ts) retains ordered, non-overlapping
ranges from one recording; it is not a general composition model.

## Known unknowns — decisions closed with the user

These scope decisions were closed by the user through the discovery conversation;
implementation mechanisms remain proposals where explicitly marked.

- **Product ambition:** replace the user's recording and editing workflow,
  including narrated demos and general imported-media editing. A transcript-only
  cleanup tool or thin UI over existing cuts is insufficient.
- **Agent interface:** CLI first, with CLI/MCP exposing the same engine. Human
  editing UI is deferred. External agents make editorial decisions; the engine
  supplies reusable operations, evidence, validation, and previews.
- **Mutation model:** commands over a managed project, atomic edit batches,
  undoable revisions, and stale-state rejection. Directly editing a JSON project
  file is not the primary mutation interface.
- **Flexibility:** general composition and explicit keyframes underpin convenient
  named operations. Convenience must not limit the editing model's expressiveness.
- **Acceptance workflow:** screen-and-webcam tutorial, multiple takes, mistake
  removal, imported screenshots/footage, captions, music, animated zooms, and export.
- **Composition:** insert footage into a sequence or overlap it with existing
  video, including presenter and picture-in-picture layouts. Independent audio
  supports music and voiceover across clips.
- **Independent media:** replace visuals while preserving audio, replace audio
  while preserving visuals, and retime either independently. Ordinary related
  audio/video edits preserve intentional synchronization.
- **Audio stretching:** support both actual duration changes with pitch preserved
  by default and unchanged narration beneath new/replaced visuals.
- **Attachment:** effects follow their content by default, with explicit project-time
  placement available. Cuts trim or split attached effects with surviving content;
  deleting all attached content removes the effect.
- **Delivery:** local videos and portable editable projects first. Hosted watch-link
  sharing is deferred.
- **Compatibility:** use a fresh project model. Preserve original media for import
  into new projects; do not migrate old edit histories or add compatibility scaffolding.
- **Speech generation:** add local generation of replacement/inserted words,
  conditioned on an agent-selected audio reference. The reference can come from
  the current video, any other local audio, or a past project; do not require a
  dedicated enrollment recording or restrict references to one saved voice profile.
  Waveforms help locate a reference; synthesis consumes actual audio samples.
  Model choice, whether fine-tuning is needed, and achievable splice quality are
  unproven. Original request: pronunciation corrections and wording changes in
  the user's voice.
- **Creative boundary:** exclude lip-sync generation. Whether to cover changed
  speech with screen footage or B-roll is an external agent's creative decision;
  the engine neither requires cover nor chooses it automatically.
- **Agent guidance:** include a product-use skill in the root-level
  `skills/screenrec/SKILL.md`, matching `~/dev/jevgrep/skills/jevgrep/SKILL.md`.
  The [current skill](../../skills/screenrec/SKILL.md) teaches only existing CLI
  behavior; extend it alongside verified new operations. Its CLI claims were
  checked against code and a blind read-only retry/stale-state exercise.

### Proposals at discovery handoff

Superseded by the spec's [inspection contract](contracts.md#inspection-exports-and-supported-media)
and slices 11/12/12b; retained here to distinguish original suggestions from decisions.

Expose complete audio tracks plus bounded waveform data/images, spectrograms,
audio excerpts, and frames to help agents choose and verify cuts. The user
suggested exported audio for waveform inspection; artifact formats, generation
costs, and exact tool contracts still need research. Timing evidence must not
silently turn heuristic silence detection into editorial decisions.

The named scope questions are closed. Exact operation contracts and feasibility
remain technical research items, not permission to silently reduce agreed scope.

## Unknown knowns — preferences extracted from the user

- **Audience:** both colleagues/customers and public tutorial viewers. Choose
  editorial treatment per project rather than imposing one house style.
- **Speech cleanup:** remove audible fillers, accidental word repetitions, and
  false starts; preserve deliberate emphasis. Slow rushed speech with pitch
  preserved and related video/captions synchronized. The recommendation is to
  adjust rushed passages locally instead of slowing the entire recording.
- **Completion:** the agent verifies and exports autonomously, then supplies a
  brief change summary. No draft approval is required by default; the user can
  request revisions afterward or override the workflow per request. Report
  unresolved verification limitations rather than claiming unperformed checks.
- **Output:** arbitrary requested canvas dimensions, chosen per project; no
  mandatory bundle of widescreen/vertical renditions.
- **Creative ownership:** the user's correction of the proposed cover/lip-sync
  choice clarified that engine capabilities must not impose editorial policies.
- Runtime baseline is the existing local macOS product; no additional platform
  has been requested.

## Unknown unknowns — evidence and research gates

This was a bounded read-only survey of the existing paths, not runtime validation
or a claim that every future implementation file has been identified. Selected
sections of 24 code files were inspected across core, protocol, service and native
media, plus targeted searches in two timeline/transcript paging files. The
limitations below are current scope constraints, not demonstrated bugs in the
existing single-recording workflow.

| Status | Evidence and why it matters | What changes / what unblocks it |
| --- | --- | --- |
| DECIDED scope; OPEN design | [Timeline identity](../../packages/core/src/timeline.ts) is anonymous source spans, merges adjacent spans, and rejects repeated/reordered source use. Effects cannot follow a particular reused clip occurrence. | Fresh assets and clip-instance identities with explicit placements, attachments and time mappings. Unblock through a composition contract and fixtures for repeat, split, move and delete. |
| OPEN | [Transcript reads](../../packages/core/src/transcript-read.ts) page/search in source order, and timeline source lookup selects a first occurrence. Relaxing span validation alone would lose repeated words/events. | Specify source versus project inspection and occurrence-aware playback pagination, preserving revision/generation pins. Verify repeated, reordered and stretched speech. |
| OPEN | [Native presentation](../../helpers/mac/Sources/ScreenRecorderFrames/PresentationSource.swift) requires equal source/playback durations; [movie assembly](../../helpers/mac/Sources/ScreenRecorderWire/MovieOperation.swift) derives audio spans from video. | Carry independent AV timing through native execution. Compare pitch-preserving stretch candidates and test synchronized versus deliberately unlinked clips. |
| OPEN | [Audio layout](../../helpers/mac/Sources/ScreenRecorderAudio/ExcerptLayout.swift) accepts each narration/system role once; [PCM mixing](../../helpers/mac/Sources/ScreenRecorderAudio/AudioPCMStream.swift) has fixed gains and short join ramps. | Introduce placeable audio instances and automation. Test music/voiceover overlap and actual joins; click suppression does not prove natural replacement speech. |
| OPEN | [Video renderer](../../helpers/mac/Sources/ScreenRecorderFrames/VideoRenderer.swift) takes one source and pointer composition; [capture selection](../../packages/protocol/src/capture.ts) has no webcam track. | Prove layered rendering, animation, captions and requested canvas sizes; prove simultaneous webcam/screen capture separately from imported presenter footage. Share composition evaluation between previews and exports. |
| OPEN | [Edit transactions](../../packages/core/src/library.ts) atomically change one span-based operation and undo span state. | Atomic composition batches must include keyframes, attachments and generated-asset references. Specify preparation versus commit, retry identity and crash recovery; test all-or-nothing failure and replay. |
| OPEN | [Package validation](../../packages/core/src/package-manifest.ts) requires exactly one source video with fixed media roles; [package readers](../../apps/service/src/package-media.ts) resolve those fixed paths. | Define asset ownership and a portable dependency manifest for imported/generated media and any retained generation references. Test relocation and deletion of original external paths. Cross-project references must not silently break when another project disappears. |
| SHARP EDGE | Native dimensions are codec-constrained; arbitrary requested canvas dimensions do not imply every codec accepts every pixel size. | Specify supported export profiles and explicit padding/rejection rules, never silent reframing. Verify requested geometry through both preview and export. |

- The single-source ordered timeline cannot directly represent rearranged takes,
  layered media, or independent audio timing. Scope requires an engine change.
- Transcript word IDs are generation-scoped and reads expose retained fragments;
  editing intent must not lose its revision/generation context.
- [Measured word boundaries](../recording-for-ai/assets/speech/boundaries/README.md)
  missed the timing target, and some boundaries clipped speech. The same evidence
  records amplitude detection confused by keyboard/mouse noise. Waveforms and
  silence candidates are evidence, not proof of safe cut points.
- Current transcription can omit fillers. The requested speech-cleanup workflow
  needs audio evidence beyond transcript matching; capability must be validated
  on audible fillers, repetitions, and rushed passages, not inferred from a render.
- **OPEN research:** source/project time mapping under reordering, repeated source
  use and retiming; attachment identity; rendering/preview parity; audio stretch
  quality; imported-media handling; portable project dependencies; bounded
  inspection and long-project performance; actual agent media-verification abilities.
  Unblock bounded-inspection and scaling choices through long-project fixtures
  measuring paged access, targeted preview latency and peak resources. Unblock
  agent verification through a real CLI/MCP edit-and-inspect journey, including
  clients that cannot directly listen to audio.
- **Local voice feasibility:** [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS)
  documents reference-audio cloning and [single-speaker fine-tuning](https://github.com/QwenLM/Qwen3-TTS/blob/main/finetuning/README.md).
  [MLX Audio](https://github.com/Blaizzy/mlx-audio/blob/main/mlx_audio/tts/models/qwen3_tts/README.md)
  exposes reference cloning on Apple Silicon. These are research candidates,
  not a selected or validated stack. Local host inspection found an M5 Pro with
  48 GiB memory; no model was installed, trained, or benchmarked. Test identity,
  pronunciation, contextual delivery, splice continuity, duration control,
  resource use, and fully local execution on the user's actual recordings.
  Include same-take, external-file and past-project references in the experiment;
  reference selection stays with the external agent. Generation is optional per
  edit and must not require an embedded editorial assistant.

### Coverage

Code inspected, at relevant sections:

- `packages/protocol/src/{operations,capture}.ts`
- `packages/core/src/{timeline,library,transcript-read,audio,timeline-inspection,preview,package-manifest}.ts`
- `apps/service/src/{operations,package-media,package-preview,exports,render,package-audio}.ts`
- `helpers/mac/Sources/ScreenRecorderFrames/{VideoRenderer,PresentationSource}.swift`
- `helpers/mac/Sources/ScreenRecorderWire/MovieOperation.swift`
- `helpers/mac/Sources/ScreenRecorderAudio/{AudioTypes,AudioPCMStream,ExcerptLayout}.swift`
- `helpers/mac/Sources/ScreenRecorderCapture/{NativeCapture,CaptureTypes}.swift`
- `helpers/mac/Sources/ScreenRecorderMedia/TimeSpan.swift`

Additional searches: `packages/core/src/transcript-pages.ts` and
`apps/service/src/timeline-inspection.ts`. The existing word-boundary evidence
linked above was read; no new capture, model training or media benchmarks ran.

### Facts to confirm before implementation

- Supported import/export formats and media normalization, frame-rate/color and
  orientation behavior; resolve through representative imported fixtures.
- Exact keyframe/interpolation, attachment and timing semantics; resolve in the
  composition contract before renderer integration.
- Model/runtime licensing, pinned versions, local installation and resource costs;
  resolve during voice and stretch experiments, not from marketing claims.
- Scope of project-contained assets versus optional generation provenance, and
  the persistence of references borrowed from old projects; resolve in the asset
  ownership/portable package contract.
- Voice identity, pronunciation, filler recall and join quality on real speech;
  resolve with measured experiments, reporting failures without dropping scope.

## Copyable next prompt

The discovery kickoff has been fulfilled by [README.md](README.md). To build:
implement that spec starting at slice 00, preserve the decisions here, and update
its handoff and evidence after each pass. Do not present proposed APIs or model
capabilities as shipped.

## Processing scope amendment

The [processing discovery](PROCESSING-MAP.md) records the later accepted simple
stack API. Its reconciled [contract](processing.md) adds nested target processing
and preserves compatible processing on replacement; original source-attached
media/caption removal rules remain distinct. Follow the current README handoff.
