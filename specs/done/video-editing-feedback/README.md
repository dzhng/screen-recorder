# Reliable autonomous video editing

Status: closed rationale. The implementation is shipped in the repository, with
several quality boundaries deliberately retained as refusals because the frozen
real-video evidence did not justify promotion.

## Purpose

A video-editing agent needs evidence and precise operations, while the caller
owns the editorial decision. This work turned feedback from the retained trailer
project into durable contracts for speech, picture, audio, captions, multicam
sources, speaker attribution, transitions, and autonomous delivery. The result
lets an agent inspect media, compose explicit edits, verify delivered artifacts,
and preserve every failed hypothesis without silently changing the source.

The implementation is intentionally local and reproducible. The registered
transcription and speaker runtimes are pinned and prepared automatically when
those features are used; other first-party runtime types retain their explicit
preparation contracts. Other capabilities remain recommendations for the
consumer workflow.
There is no built-in editorial policy, cloud inference dependency, or human QA
gate.

## Why the system has this shape

Observations are not permissions to edit. A detector can report a face, a word,
a speaker turn, or a scene, but only an explicit caller request can crop, cut,
label, switch, or style it. This keeps uncertainty visible and prevents a
plausible measurement from becoming an unasked-for edit.

Source media remains byte-for-byte intact. Projects and exports are revisions
owned by the existing publication lifecycle, so retries and undo operate on
owned artifacts instead of mutating recordings. The public CLI, MCP surface, and
app use the same operation handlers and contracts; a capability is not complete
until those entry points agree.

Time is represented by the clock that actually owns it. Source, project,
speaker, session, and delivered-file time are separate until an explicit mapping
has evidence. Speech estimates may overlap or be instantaneous; authored edit
ranges remain exact. A timestamp coincidence never creates a synchronization or
cross-plane relationship.

Every product-relevant research experiment and result is retained as a replayable
receipt; source research is frozen with hashes and excerpts. A failed quality gate
is a product boundary, not a reason to loosen a tolerance, widen a box, invent a
missing word, or claim that an unavailable device passed.

## Invariants and code pointers

- Protocol schemas own public input and output shapes. Shared operation handlers
  live under `packages/core`, `apps/service`, `packages/protocol`, and the
  CLI/client adapters; their consumer tests are the contract checks.
- Exact time and occurrence projection live in `packages/composition`; native
  sample support, decoding, and rendering live in `helpers/mac` and
  `apps/macos`. Reference scripts are comparators, never a production fallback.
- Core model/evidence owners and the service own speech preparation and
  attribution. Model-runtime helpers assemble optional runtime artifacts, and
  the editing harness exercises their pinned inventory and replay receipts.
- Speaker names come from explicit caller bindings. Unknown and overlapping
  speech stay unknown or overlapping; anonymous diarizer slots are not promoted
  to stable people without continuity evidence.
- Captions, blends, tone controls, LUTs, transitions, motion coverage, and
  delivered-scene observations each have one public owner and an inference-free
  replay under `packages/test-harness/editing`.
- Fresh-agent routing and production-native delivery identity are pinned by the
  autonomous routing and media replay tests. The replay suite is evidence of the
  declared scope; it does not promote a refused gate.

## Boundaries that remain intentional

The frozen evidence still refuses four broader claims:

- complete face localization through Graham's occlusions;
- one global clock across unlike microphones;
- strict moving transition parity against the independent reference oracle;
- four-speaker, ten-minute continuity and attribution quality.

The accepted behavior is the bounded behavior around those limits: explicit
observations, source-bound local bridges, caller-authored geometry and angles,
short-range speaker preparation, and truthful refusal receipts. Screen/camera
permission and live-device checks are recorded as unverified on machines without
the devices; they do not change the offline contracts.

## Dead ends retained as evidence

Temporal Vision tracking cleared the overlap metric but predicted through an
occlusion, so it cannot replace observed face rectangles. Landmark envelopes,
body-pose joints, and person segmentation also failed the unchanged full-face
contract. Waveform and lexical hypotheses did not establish a global unlike-mic
clock; repeated bridge windows disagree beyond the frozen tolerance. Native
source conversion explains part of the moving transition difference but does
not satisfy strict parity. Speaker transport was proven complete, so the
remaining four-speaker refusal is a provider-quality result rather than an early
stop. These receipts remain under the corresponding evidence directories and
are replayed without rerunning inference.

## Evidence and visual provenance

The retained corpus, real-session feedback, and retrospective remain in
[`FEEDBACK.md`](FEEDBACK.md), [`retro.md`](retro.md), and [`assets/README.md`](assets/README.md).
The `assets/01-*` directories preserve the compact real-media observations and
controls. The `assets/27-29-transitions` directories preserve the delivered
frames, videos, comparison images, and independent reference imagery used to
judge transition and motion behavior. Speaker, synchronization, scene, and
fresh-agent evidence retain their source hashes and replay receipts alongside
their visual artifacts. The fixture manifests under [`fixtures/`](../../../fixtures/)
point at this archived evidence, so a reader can trace a claim from the public
test to the original retained bytes.

The visual standard is retained directly in the evidence tree: the independent
moving-transition frames ([100 ms](assets/27-29-transitions/reference-parity/reference/moving-100000.png),
[500 ms](assets/27-29-transitions/reference-parity/reference/moving-500000.png),
[900 ms](assets/27-29-transitions/reference-parity/reference/moving-900000.png))
come from the frozen transition comparator, while the [motion-blur comparison
sheet](assets/27-29-transitions/motion-blur/comparison/base-side-by-side.png)
shows the authored trajectory standard used for the bounded appearance envelope.
These references drove the parity and readability checks; they are not claims
that the still-open strict moving gate passed.

Copied upstream model cards and the original project snapshot retain historical
links to documentation and source briefs that were not copied. Those links are
provenance, not prerequisites for replay. Corpus behavior receipt paths use the
fixture manifest as their base, matching `certifyCorpusBehavior`; they are not
relative to the receipt file itself.

The original planning material and choices ledger are retained beside the
rationale for historical context. They are not additional implementation
instructions; the code and the replay tests above are the current owners of
behavior.
