# Exploration map

Completed 2026-10-04. All four quadrants have been visited. Research-dependent
claims remain OPEN with an owning checkpoint; completing discovery does not
establish implementation readiness. The [canonical plan](README.md) supersedes
the exploratory ordering below.

## Known knowns

### User direction

- Deliver the proposed product workflow updates and an FFmpeg parity spec.
- Bundling and using FFmpeg is allowed where it makes sense; wholesale replacement
  of native execution has not been requested or decided.
- Consumer skill guidance should use our tools and retain useful optional numeric
  starting points for fades, padding and other editorial techniques.
- The intended user has essentially no video-editing experience. They point an
  agent at the repo and use the consumer skills to get polished edits from a
  plain-language request. The user explicitly excludes replacing an expert
  professional editing workstation as the product goal.

### Facts disclosed during discovery

- Current consumers do not install FFmpeg for supported product operations.
  Runtime execution is native; the local FFmpeg installation serves development
  and verification, not the released product's media runtime.
  Evidence: [native guide](../../helpers/mac/README.md),
  [app builder](../../scripts/build-macos.mjs),
  [release packager](../../scripts/release.mjs); no FFmpeg/ffprobe references in
  service, core or native execution sources in the inspected checkout.
- Placement, exact rational clocks, ordered processors and state domains are
  already owned by [composition](../../packages/composition/README.md).
  Any backend must consume that meaning, not recalculate editorial intent.
- Capability admission and execution readiness are distinct. The
  [service](../../apps/service/README.md) composes existing owners; the
  [protocol](../../packages/protocol/README.md) supplies shared operation schemas.
- Current [video delivery settings](../../packages/composition/src/output-settings.ts)
  select MP4/H.264/Rec.709 with AAC. Wider codecs/containers require explicit
  capability contracts rather than an implied FFmpeg default.
- Current [processor registry](../../packages/composition/src/schema.ts) includes
  geometry, opacity, pointer, gain and RNNoise. Grade, limiting, sidechain and
  loudness-normalization additions need new declared processing semantics.
- Video execution explicitly refuses unsupported HDR/wide-gamut/custom profiles
  rather than silently tone-mapping. Asset facts already expose primaries, transfer
  and matrix. Evidence: [color policy](../../helpers/mac/Sources/ScreenRecorderFrames/VideoColorPolicy.swift)
  and [asset schema](../../packages/core/src/assets.ts).
- FFmpeg filter availability is build-dependent. Its
  [license inventory](https://github.com/FFmpeg/FFmpeg/blob/master/LICENSE.md)
  lists `vf_eq.c` among GPL parts. A selected bundle needs a verified capability
  inventory; local Homebrew capabilities do not establish release capabilities.
- The [release machinery](../../scripts/README.md) already supports pinned runtime
  acquisition, bundle-relative resolution, third-party notices and signing.
  [Release inputs](../../scripts/release-inputs.json) do not currently include FFmpeg.
- Local `ffmpeg -version` reported a Homebrew build with `--enable-gpl`, x264
  and x265. It is not a preselected distribution input. The official
  [FFmpeg licensing guidance](https://ffmpeg.org/legal.html) explains that build
  components change licensing and corresponding-source obligations.

### Scope carried into planning

The user selected common offline workflows through typed screenrec operations.
The agent disclosed that all proposed workflow additions will be carried into
planning: combined inspection, compact transcripts, review bundles,
loudness measurement, captions, color/HDR, motion-asset interchange, richer speech
evidence, mastering, editorial memory and batch preparation. Individual feasibility
and acceptance decisions remain open; the user can narrow the roster during the walk.

## Known unknowns

Decisions and pending questions:

**What does FFmpeg parity mean?** Answered by the user: common offline media
workflows through typed screenrec operations. Reason: preserve one public project
contract while using FFmpeg where useful. Arbitrary command/filtergraph exposure
as service operations and native-executor replacement were not selected. A later
user instruction explicitly allows direct invocation of the bundled FFmpeg CLI
for extra non-core tasks, with a simple one-line skill pointer to its location.

**Which delivery formats?** Answered by the user: initially the production set,
then permission to use the everyday set if it reduces complexity. The agent chose
MP4 H.264/HEVC, WAV, AAC/M4A and SRT/VTT and disclosed the change. Reason: avoid
additional container/codec, transparent movie and HDR output paths. MOV/ProRes,
transparent movie export, WebM, MP3/FLAC and HDR export are deferred. Workflow
additions remain in scope; explicit HDR-to-SDR source conversion remains planned.

**How are native and FFmpeg backends selected?** Answered by the user: tested
defaults per capability, preserving existing native behavior and using FFmpeg
where it fills gaps. Record implementation/version; retain a consistent
processing recipe across inspection, preview and export. No silent substitution
that changes the result.

**Does that policy improve simplicity, bugs and performance?** The user asked
before the next build decision. The agent explained that simplicity and lower
integration risk depend on one default implementation per capability, rather than
duplicating every operation in both backends. Performance is not established by
the policy and needs bounded measurements at actual integration seams. FFmpeg
process startup, extra decode/encode passes and intermediate media transfers can
erase gains. No backend benchmarks have been run in this discovery.

**Can agents use bundled FFmpeg directly for non-core capabilities?** Answered
by the user: yes, with a simple location pointer in the skill. The agent disclosed
that core operations keep typed contracts, while extra tasks can call the binary
without a wrapper for every feature. Direct artifacts can enter a project through
ordinary import and explicit placement; they do not acquire managed history or
export semantics merely by being created with the bundled executable.

**Which FFmpeg build should ship?** Answered by the user: a broad LGPL-compatible
build from pinned sources, including ffprobe and Apple H.264/HEVC encoders, with
external dependencies added only where needed. Reason: useful core execution and
general CLI fallback without requiring a user installation or unnecessary optional
dependencies. This does not promise GPL-only filters, software x264/x265 or every
optional FFmpeg component. Exact configuration and dependency versions remain
research work and must establish the promised capabilities.

### Preference checkpoint — delegated by the user

The agent inferred these preferences from the user's selected scope, format
simplification, backend choice and fallback/build directions:

- Prefer simpler scope and fewer mechanisms when they meet the workflow needs.
- Reuse proven native execution and mature FFmpeg capabilities; avoid duplicate
  implementations for the same operation without a demonstrated need.
- Bundle the required tools so consumers do not perform extra installation.
- Keep core contracts typed; allow a simple direct CLI fallback for extra tasks.
- Teach the agent editorial and technical judgment so the novice user does not
  need to learn codecs, processing stacks or expert editing software.

The user explicitly selected “Yes—use those preferences for remaining planning
choices.” This confirms the preference pattern and delegates matching planning
decisions for this walk. It does not authorize implementation. Researchable facts
will still be investigated; novel/conflicting tradeoffs will still be presented.

### Remaining named decisions — stage closed

**Answered by the agent on the user's behalf**, disclosed as a batch:

| Question | Answer | Preference and reason |
| --- | --- | --- |
| Review surface | CLI probes, real media and before/after evidence; no new editing UI | Simplicity and reuse of existing tools |
| Compatibility/migrations | Preserve current behavior and sources; no legacy wrappers or migration scaffolding | One owner and minimal mechanisms; reopen a necessary persisted-format change |
| First useful workflow proof | General imported footage (user correction); isolated primitive checks now, user-run demo later | User superseded the agent’s narrated-screen-first proposal and declined a demo edit for this spec |
| Skill acceptance | Fresh-agent novice briefs plus separate real macOS execution/output checks | Skills must teach agents; portable mocks do not prove media quality |
| Platform | Existing Apple Silicon/macOS 26+ target | Reuse current supported runtime; no cross-platform expansion |

**Answered by the territory**, disclosed with the decision rationale:
the [agent eval harness](../../evals/README.md) already isolates fresh Codex/Claude
sessions and separate grading, but Linux cannot execute native media. The
[verification harness](../../packages/test-harness/README.md) and
[retained fixture guide](../../fixtures/README.md) separately own actual-media proof.

**Recorded OPEN**, with explicit unblocking work before dependent slices:

- Exact LGPL build/dependencies: pinned-source build and relocated capability
  inventory must prove selected filters, decoders, encoders and dependency closure.
- HDR-to-SDR recipe and alpha-input support: bounded native/FFmpeg reproductions
  with real metadata/edge/motion evidence, before selecting production paths.
- Performance budgets: measure startup, decoding/transfers and actual workloads;
  no claim that backend policy itself guarantees a speedup.
- Local speaker evidence: reuse the accepted original recipe and retained fixtures;
  complete public reads and packaging without further model-quality research.

All named stage-2 questions are now answered or explicitly open for research.

## Unknown knowns

The user volunteered decisive context before this stage opened:
the workflow serves novices through their agents and should produce polished
edits without requiring professional-stack knowledge. Disclose this immediately
and use it in the acceptance target rather than waiting for the stage boundary.

Consequences proposed and disclosed by the agent: prioritize consumer onboarding,
editorial judgment, useful defaults, ordinary-language interaction and actual-output
review; add fresh-agent novice-brief journeys alongside primitive parity checks.
The product still supplies primitives; the agent makes choices within delegated
scope. The user selected general imported footage as the first experience, superseding
the agent’s screen-recording-first proposal. The [illustrative workflow](workflow-example.md)
now reflects that decision. The user then clarified that this specification needs
small isolated tool checks, not an end-to-end demo edit. Existing fixtures are
valid component inputs even though the first consumer journey is imported footage.
The new recording is for viewing the product pitch only; it is not an editing task.

## Unknown unknowns

Two independent read-only sweeps covered media execution and packaging/runtime
seams. These are contract hazards, not newly reproduced bugs.

| Landmine | Evidence | Disposition and checkpoint |
| --- | --- | --- |
| LGPL excludes familiar recipes | [FFmpeg license inventory](https://github.com/FFmpeg/FFmpeg/blob/master/LICENSE.md), configure | Decided: no GPL/nonfree baseline. OPEN: pinned build inventory; use compatible alternatives for grade, not an assumed eq filter |
| Local build differs from distribution | [release inputs](../../scripts/release-inputs.json), [probe evidence](tool-proof.md) | OPEN: matching sources, dependency closure, signing and relocated system-PATH smoke |
| Raw CLI is not the JSON worker protocol | [worker](../../apps/service/src/worker.ts) | Decided: extend the existing lifetime owner; OPEN: exit, stderr, binary output, drain and parent-death proof |
| Path reopening and nested resources change authority | [media probe](../../apps/service/src/media-probe.ts), [protocol docs](https://ffmpeg.org/ffmpeg-protocols.html) | OPEN: seekable inherited descriptors and offline resource admission; pipe is not a seekable MOV descriptor |
| Process success is not publication | [publication](../../apps/service/src/publication.ts), [native output](../../helpers/mac/Sources/ScreenRecorderMedia/OutputFile.swift) | Decided: existing jobs, private staging and exclusive publication; OPEN: crash/cancel/destination races |
| Decoder support is not project admission | [presentation source](../../helpers/mac/Sources/ScreenRecorderFrames/PresentationSource.swift), [sample timing](../../helpers/mac/Sources/ScreenRecorderMedia/SampleTiming.swift) | OPEN: each input family must supply stable streams and physical presentation support |
| Edit lists, VFR, preroll, final support, stream offsets | [media probe tests](../../helpers/mac/Tests/media-probe.test.mjs) | Sharp edge: exact shared asset origin and actual support, never average-fps timing or independently zeroed streams |
| Rotation and off-grid sample phase | [display](../../helpers/mac/Sources/ScreenRecorderMedia/VideoDisplay.swift), [caption clock](../../packages/test-harness/editing/caption-clock.mjs) | Sharp edge: rotate once; full/window render uses compiler’s absolute phase |
| Channel selection and AAC padding | [audio source](../../helpers/mac/Sources/ScreenRecorderAudio/AudioSource.swift), [drift evidence](../../packages/test-harness/editing/audio-video-drift.mjs) | Sharp edge: explicit stream/layout, authored presentation duration distinct from packet capacity |
| Stateful mastering depends on context | [audio context](../../packages/composition/src/audio-context.ts), [native state](../../helpers/mac/Sources/ScreenRecorderAudio/CompositionState.swift) | OPEN: split/full/window invariance, actual normalization mode, limiter latency and post-encode peak |
| True peak is opt-in; short/silent readings mislead | [filter docs](https://ffmpeg.org/ffmpeg-filters.html), [probe evidence](tool-proof.md) | Decided: explicit metering mode/layout/window; OPEN: calibration and unmeasurable cases |
| HDR tags do not transform pixels | [color policy](../../helpers/mac/Sources/ScreenRecorderFrames/VideoColorPolicy.swift) | OPEN: PQ/HLG-to-SDR reference and appearance checks; current local build lacks zscale |
| Captions are edited occurrences, not raw ASR | [caption seeds](../../packages/core/src/text-seeds.ts) | Sharp edge: corrected display text, repeats/retimes/anchors, exact revision and documented rounding |
| Tiny thumbnails can require huge source work | [picture executor](../../helpers/mac/Sources/ScreenRecorderFrames/CompositionPictureExecutor.swift) | OPEN: decode/seek/frame-count bounds with measured work, not output dimensions alone |
| Optional evidence can force persisted-format changes | [catalog](../../packages/core/src/catalog.ts), [packages](../../packages/core/src/project-package.ts) | Decided: task-side notes first, optional additive evidence where valid; reopen incompatible required shapes before code |

### Sweep coverage and limits

Execution sweep fully read sample timing, display, output publication, presentation
source, color policy, video rendering, audio state, caption seeds, audio context,
media-probe tests and caption-clock evidence. It partially read audio source/PCM,
picture executor, caption seed tests, A/V drift and color evidence. Packaging sweep
read release/build/smoke scripts and inputs, app runtime/bundle startup, service
worker/probe/render/publication/voice owners, output schemas and rendered receipts.
Both consulted owning READMEs; packaging also consulted official FFmpeg CLI, probe,
protocol, filter and licensing docs and relevant configure/MOV/loudnorm source.
Neither sweep ran media or release tests. Live upstream docs must be checked
against the pinned source before promising options.

### Facts the builder must still establish

Pinned release/dependency versions and corresponding-source distribution; actual
LGPL filter and Apple encoder inventory; seekable descriptor availability; complete
child retirement; offline nested-resource refusal; representative decode/transfer
cost; HDR conversion quality; alpha convention; richer speech quality and local
model cost. Each stays OPEN until its focused checkpoint passes.

### Planning latitude and next message

Answered by the agent on the user’s behalf: use helpers over existing operations
for inspection, batch orchestration and task-side notes; promote to product storage
only when reuse requires it. This follows the delegated simplicity preference and
avoids new state owners. The plan records narrower API decisions and research gates. Additional answers
on the user’s behalf, disclosed during ownership review: reuse export.create for
sidecars; meter actual asset/stream/acquisition support, refuse integrated readings
across unavailable gaps, retain explicit authored silence and make dual-mono opt-in.
Native-first HEVC/SDR correction and explicit managed HDR derivatives preserve the
existing renderer. Dynamics mode/units/context freeze in separate reproductions;
linear normalization refuses infeasible targets rather than silently becoming
dynamic. Speech families retain separate verdicts; a changed HDR build dependency
reopens the pinned receipt and affected tests. These follow simpler ownership and
consistent results rather than adding hidden defaults or compatibility machinery.

A possible next instruction: “Implement the first slice of the FFmpeg parity spec.
Keep later slices unopened until its focused proof passes.” This map and spec do
not themselves authorize implementation.
