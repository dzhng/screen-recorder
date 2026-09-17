# Recording for AI — four-quadrant map

Implementation handoff: the [implementation spec](README.md), [contracts](contracts.md),
and linked slices now resolve or assign gates to the technical OPEN items below.
This map retains discovery history; its OPEN list and copyable next request are
superseded as execution instructions. Product decisions remain authoritative.

Status: historical discovery handoff. Product decisions are recorded; technical
unknowns below describe the discovery stage. Current implementation progress and
verification are tracked exclusively in the [main handoff](README.md#next-agent-prompt).

## 1. Known knowns

Build a macOS menu-bar recorder that prepares narrated visual evidence for external
AIs. The consuming AI interprets demonstrations and chooses edits; the product
captures, transcribes, exposes, and edits recordings through explicit operations.

The project directory was empty at the initial scan. The existing reference
monorepos establish the requested development pattern:

- Factory and Photoctl manifests: Bun workspaces under `apps/*` and `packages/*`,
  TypeScript/ESM, Turborepo, oxfmt, and oxlint.
- Photoctl development guide: separately built native components, with Bun
  orchestration and a distinct runtime boundary.
- Photoctl CLI and protocol manifests: explicit workspace dependencies and shared
  contracts.
- Factory and Photoctl agent guidance: focused iteration checks, broad closeout
  verification, and real end-to-end evidence.

Follow that monorepo pattern. Keep native macOS code behind an explicit build and
protocol boundary; do not infer a requirement for Rust or a web-based desktop shell.
Give shared recording, timeline, and edit semantics one owner for app, CLI, and MCP.

## 2. Known unknowns — decision ledger

Unless marked otherwise, the user closed these decisions during the walk.

| Question | Decision and reason |
| --- | --- |
| Primary purpose | Evidence for external AIs; no internal assistant or semantic editing model. |
| Live or recorded | Inspect after recording; original media remains available for additional frames. |
| Storage/access | Local storage, local MCP and CLI, plus explicit portable export. |
| Handoff | Ask for the latest recording; resolve to a stable ID for follow-up calls. |
| Availability | Expose newest recording immediately with status; never silently substitute an older ready recording. |
| Processing failures | Separate video, transcript, and index readiness; report failure/retryability and allow retry from retained sources. |
| Transcription | Local, English first; word-level timing required for editing. On 2026-09-17, after no evaluated engine met verbatim filler fidelity, the user chose to ship word-timed transcripts without guaranteeing filler capture: fillers appear when the engine emits them. |
| Capture area | One selected display, window, or rectangular region. |
| Audio | Microphone narration plus optional system/browser audio, stored separately for independent narration transcription. |
| Controls | Start, stop, cancel, pause/resume, restart via menu bar and keyboard shortcuts. Restart discards the take. |
| Drawing | Deferred; preserve cursor movement instead. |
| Cursor presentation | Default preceding two seconds, fading toward oldest; configurable duration and clean-frame requests. |
| Trail boundaries | Shorten at detected scene changes and pause boundaries; retain raw cursor data. |
| Screenshot selection | Visual changes plus periodic coverage, suppressing near-duplicates; arbitrary timestamp requests remain available. |
| Initial inspection | Timestamped transcript plus screenshot index; fetch images separately. |
| Exports | Exactly two: playable video with audio for humans; complete processed package for AI. |
| AI package contents | Original media, transcript, selected screenshots, index, and timed cursor data. Edited-package details remain OPEN below. |
| Retention | Keep media and derived data until manual deletion; show storage usage. |
| Initial audience | David's own Mac first; tester and public releases are future specs. |
| Editing | Trim ends and cut middle sections through complete MCP/CLI capabilities. External AI translates intent into ranges. |
| Edit model | Non-destructive edit list, original preservation, undo, stable revision IDs; inspect/export current edit by default. |
| Concurrent edits | Edits require inspected revision; reject stale requests without mutation and return current revision. |
| Editing UI | Future thin UI over existing CLI, with no independent editing logic. Recording controls remain in initial app. |
| Pause timing | Playback time throughout; omit paused audio/cursor data, but include pause marker and real pause duration in transcript/timeline. |
| Interrupted capture | Preserve usable partial material, mark interrupted, expose what recovered; recovery mechanism is OPEN. |

## 3. Unknown knowns — extracted context

- The first real scenario is developing a website in a browser on localhost.
  Recording scope remains general; browser-only capture was not requested.
- Optimize for 20–60 second pointers and 2–5 minute walkthroughs. Longer recordings
  remain inspectable through paged transcripts and indexes; these are not hard limits.
- The agent can observe processing state, wait, and request the transcript again.
  No push-delivery requirement or automatic sending into an AI conversation was added.
- API completeness matters more than an editing UI. A request such as "cut out the
  ums" must be achievable using evidence plus ordinary edit operations.
- Existing monorepo conventions are a user requirement, not an invitation to copy
  another product's runtime, platform dependencies, or architecture wholesale.
- A particular consuming AI application was not selected. Client-level image and
  tool compatibility remains OPEN rather than assuming all MCP clients behave alike.

## 4. Unknown unknowns — findings and validation queue

Coverage: initial scan found zero implementation files. Reviewed reference manifests,
guidance, and product decisions, plus official transcription-product and MCP docs.
Native capture and model performance have not been tested. Design-derived risks
below are hypotheses to verify, not observed implementation defects.

| Finding and evidence | Why it matters / disposition |
| --- | --- |
| Fillers may be omitted; no candidate has been evaluated on this task. | **OPEN:** compare actual narration with model output and word boundaries; include ums, repetitions, silence, and technical vocabulary. Do not promise reliable filler cutting from model marketing alone. |
| Static screen plus moving cursor follows directly from the accepted pointing workflow. | **OPEN:** deduplication must retain evidence of emphasis. Validate selection on deliberate circles and waving without interpreting gestures with an AI model. |
| Scrolling changes content beneath historic cursor positions. | **DECIDED:** shorten trails at scene changes; **OPEN:** validate detection thresholds on scrolling, navigation, and animation. |
| Pause introduces elapsed-time versus playback-time ambiguity. | **DECIDED:** playback timestamps and explicit pause markers; one timeline mapping for all artifacts. |
| Cutting changes subsequent playback timestamps. | **DECIDED:** revision-bound operations and shared source-to-edited mapping. **OPEN:** specify cut endpoint rules, split words/markers, trail resets across cuts, and audio joins before implementing edits. |
| Current edit differs from original media in the portable package. | **OPEN:** proposed package includes original media plus edit list and clearly identifies the current revision. Finalize package layout, revision references, and how exports represent edited transcripts/frames. |
| Crashes can leave unusable media containers. | **OPEN:** interrupt a native recording spike and demonstrate recoverable finalized material; scope what can be recovered honestly. |
| Processing failure differs from unfinished work. | **DECIDED:** independent readiness and explicit retryability; **OPEN:** specify restart persistence, bounded retries, and recovery from interrupted processing. |
| MCP image content and resource links are separate result types. | **SHARP EDGE:** return actual MCP image content for frames; CLI emits files plus metadata for an image-reading tool. **OPEN:** verify one real client sees the frame and performs an edit. |
| Window/region capture changes cursor coordinate space. | **OPEN:** verify crop, scale, display origin, moved/resized windows, and source disappearance in a native capture spike. |
| Large recordings and repeated frame requests can grow work without bound. | **OPEN:** choose page/image limits and caching behavior; validate long recording inspection without loading all media or images into memory. |

Primary sources checked:

- [Superwhisper model list](https://superwhisper.com/models): local Parakeet,
  Whisper variants, and Cohere Transcribe. Vendor performance figures are not
  measurements of this app or its timestamp/filler requirements.
- [Willow privacy documentation](https://help.willowvoice.com/en/articles/12854269-how-willow-protects-your-data-and-privacy):
  cloud transcription; it does not establish an on-device implementation to copy.
- [MCP tool results](https://modelcontextprotocol.io/specification/2025-11-25/server/tools):
  image content, structured content, and resource links are distinct representations.

### Small facts and contracts to confirm before coding

- David's hardware/macOS version; minimum target; native app/build tooling.
- Local model runtime, acquisition, license, resource footprint, filler fidelity,
  and timing quality. Run one focused comparison rather than building a model picker.
- Node versus Bun runtime and test runner; reference projects differ here.
- CLI/MCP process ownership and transport; shared contracts and exact package seams.
- Concrete consuming client and how its agent opens CLI-produced images.
- Source-specific system audio selection, mute behavior, and human-export audio mix.
- Resolution/readability, frame timestamp tolerance, index sampling, and page limits.
- Batch-cut atomicity, range coordinate rules, undo scope, and export revision snapshot.
- Edited export semantics, package inspection/import support, and portability target.
- Playback/library surface needed in the initial app; webcam is not established scope.
- Compatibility/migration policy before drafting the implementation ladder; none has
  been explicitly requested for this new project.

## Follow-on specs

- [Main decision record](README.md)
- [Small tester release](../tester-release/README.md)
- [Public release](../public-release/README.md)
- [Editing UI](../editing-ui/README.md)

## Copyable next request

> Turn this map into an implementation spec. Follow the factory/photoctl monorepo
> pattern. Resolve the named platform and API contracts, use focused spikes to
> validate local transcription, capture recovery, cursor alignment, and actual AI
> inspection/editing, then slice the personal release into independently verifiable
> checkpoints. Keep tester release, public release, and editing UI as future work.
> Surface any failed assumption instead of silently reducing the agreed capabilities.
