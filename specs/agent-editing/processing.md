# Ordered processing

Status: planned. The [completed discovery map](PROCESSING-MAP.md) records the
user decisions. This is the canonical processing contract; implementation and
quality status live in the [slice checklist](README.md#global-checklist).

## One stack per target

A target is a clip, track, processing group or final output. Get its stack; set
its entire ordered list in one revision-bound edit. List order is execution order.
Repeated processor types are allowed. Each instance has a stable ID and an
`enabled` flag; bypass keeps its position and settings. Empty stacks are identity.
There is no inherited member configuration, per-member exemption from a parent
step, parallel routing, or user-facing source/project stage selector.

The planned read is `processing.get({projectId, revisionId, target})`. The only
stack mutation is `{operation: "processing.set", target, steps}` inside
`edit.apply`. Multiple targets can be set in one atomic batch. Get returns the
canonical list and diagnostics, so agents can edit it and set it back. Omitted
steps are removed; an empty list clears the stack. Existing IDs must belong to
that target and occur once. New steps omit ID, optionally bind a batch label,
and receive IDs from the existing transaction namespace. To copy settings to
another target, omit the source step IDs. Receipts return normalized complete
stacks, generated IDs and processing lineage. Unchanged lists are no-ops.

Use one canonical collection `Composition.processing: {target, steps}[]`, at
most one nonempty entry per target. Entry order has no execution significance;
step order does. Replace the unshipped empty `effects` placeholder; do not retain
an adapter or parallel effect store. Composition owns the closed processor union,
validation, edit algebra and compiler. Protocol imports it. Registry-derived
`processing.capabilities` reports actual media compatibility, parameter units,
bounds, automation support, preparation requirements and implementation identity.
A schema accepted by the pure authoring model is not proof of native readiness;
public discovery must distinguish authoring from execution support.

Targets discriminate `{kind: "clip", id}`, `{kind: "track", id}`,
`{kind: "group", id}` and `{kind: "output"}`. Clip/track/group resolve one media
kind; output has audio and video components. Each typed output step processes its
component while passing the other through. Registry-declared target compatibility applies in addition to media kind. Unknown
or incompatible processors reject even when disabled. Source-attached pointer
presentation requires an explicitly acquisition-bound video clip, as defined in
[slice 15](slices/15-layer-geometry.md#source-attached-pointer-contract). No arbitrary filter strings or generic parameter-path
language. Gain is the first stateless audio variant; geometry, opacity and pointer
presentation join through slice 15, curves through 16, verified denoise through
15a. EQ/compression are potential extensions, not required shipped variants.

## Combining targets

Processing groups are distinct from synchronization groups: one controls
combination and effects, the other linked structural edits. A track/group has
one optional `parentId`; omission means output. Groups have an ID, audio/video
kind and sibling order. Parents must exist, match media kind and form an acyclic
forest. Clips retain their existing track owner. Groups do not have a separate
timeline, duration, speed or transform outside their processing stack.

Composition owns `group.add`, `group.remove` and `routing.set` edit operations.
Add allocates an ID/optional label; remove requires no child tracks/groups (an
absent ID is a no-op) and removes its owned stack. Routing.set addresses one
track/group and assigns parent plus order atomically. Track.add accepts parent;
track.remove removes its stack. Parent changes never move clips in time or alter
synchronization links. Video sibling order is unique across tracks and groups
under the same parent, lower behind higher. `track.reorder` is replaced by
`layers.reorder`, a complete ordered permutation of video track/group siblings
under an addressed parent. The compiler's depth-first leaf order also supplies
the deterministic projected-evidence track rank; no second global layer order.
Audio summation order is canonical but carries no creative priority.

Fixed execution is decode/orient/select → explicit resample/channel mapping and
retime/pitch handling → clip stack → track combination and stack → enclosing
group combinations and stacks → output combination and stack → encode. Workers
must not move denoising before retiming or distribute a parent effect to children
unless exact equivalence is proven. New clips pass through the track stack by
contributing to its result; they receive no copied settings. An exception uses a
clip stack or a separately routed track.

Video clip stacks start in oriented source coordinates. Crop acts on the previous
image's pixel domain; geometry's fit/pivot/rotation/translation produces a
project-canvas surface. If a stack ends in source space, the compiler applies the
declared baseline contain placement once. Track/group intermediates are fixed
project-canvas transparent surfaces; children composite in sibling order. Parent
stacks process that flattened image, so parent opacity affects the combined group.
Final video combines over the declared canvas background before output processing.
Pointer presentation uses the same composed geometry as its source. Slice 15
proves each coordinate bridge and real noncommuting processor order; there is no
implicit content-derived group bounding box that shifts as children animate.

## Timing and structural edits

Processors initially preserve duration. Account for latency and tails without
moving clips or extending the project. Whole-target activation is the default.
Optional windows reuse the existing Anchor model: clip windows may use that
clip's content/fractions or explicit project time; track/group/output windows use
project time. Nonclip windows cannot borrow one child's source clock. Windows do
not extend project duration. Outside a declared window/transition the result is
dry; transitions and animated parameters must be explicitly supported by the
processor. Curve compilation remains the single owner in slice 16.

Clip move/retime follows the existing anchor rules. Duplicate creates fresh step
IDs and remaps clip-local references. Split/trim restrict windows and curves and
report lineage; the whole original function must be preserved, not just endpoint
values. Whole-target activation on a new child covers that child's whole duration.
Stateful clip membership is explicit revision data. Instance IDs remain unique and target-owned. Absent `stateKey` means independent state; an explicit key means shared continuity in a distinct namespace, never an ancestor lookup. First split uses the newly allocated child step ID as shared token on both pieces, so detaching and resplitting a token owner cannot reconnect old siblings. Existing shared splits and replacement padding preserve membership. One duplicate operation preserves copied siblings' mutual continuity under a fresh copied-member token, independent of originals and separate duplicate calls. Existing get/set roundtrips may preserve a key; omission preserves it, while fresh authored steps cannot invent memberships.

Domains derive only from current retained inputs and ordered prefixes, before requested output/tap slicing. Trim/removal changes that domain rather than cropping old processed output. An edit that creates incompatible cross-track membership or state-domain dependency cycles detaches participating changed occurrences, visible in ordinary processing receipts; ordinary prefix gain changes do not detach. Independent imported documents must validate their declared domains without editor repair. [15a2a](slices/15a2a-state-domains.md) establishes clip continuity; [15a2b](slices/15a2b-parent-state-windows.md) extends the same pure owner to structural parent domains and authored activation. Runtime/channel/prepared acceptance remains in 15a2.

Fresh placement has an empty clip stack. Clip deletion removes its owned stack;
parent stacks remain. Shared processing continues across child cuts.

Replacing media preserves compatible settings by default, with `processing:
"reset"` as an explicit replacement option. Preserve owned processing separately
from source-attached media/captions, whose established removal rules still apply.
Source-independent settings and normalized windows survive. Source-domain windows
or profiles tied to the old source require explicit repair/reset; reject the
replacement atomically with target/step/dependency diagnostics rather than
silently dropping steps or publishing an unrenderable revision. Repair/reset can
precede replacement in the same batch. Hold/silence padding expansion partitions
retained processing over the prefix and tail, preserving the original interval;
stateful preparation must cover that expansion, not restart at its internal cut.

A pure split must not alter audible/visible output. New IDs are not DSP resets.
Stateless lifecycle can land first, but a stateful processor cannot become ready
until its context/evaluation-origin or retained-output strategy proves pure-split
preservation, changed-input invalidation and isolation from excluded material.
Do not weaken the speech/endpoint gates or silently process an entire source to
avoid resolving context. Reproduction must distinguish a pure split from an edit
that changes the retained signal. Failures reslice the seam before adoption.

## Preparation, inspection and portability

One core prepared-derivative owner serves retiming and processors through the
existing job queue; no DSP/model work runs in a project transaction. Compiler
records carry ordered steps, routing, windows/curves, upstream context, rendition
and pinned implementation/model identities. Reorder or upstream edits invalidate
affected derived work. Model preparation is explicit; never download at render
time, silently upgrade an implementation or export dry media on missing backend.

Inspection explicitly distinguishes immutable raw source evidence from processed
target output. Dry and after-step taps use the same compiler/executor as preview
and export; tapping one target excludes later parent stages and reports that fact.
Frame/audio/waveform/spectrogram artifacts identify target, tap, revision and
processing dependencies. A late window matches the corresponding full result
using proven bounded context/checkpoints or explicit preparation, never hidden
unbounded prefix replay. Empty/bypassed stacks need no model preparation.

Retain exact model-dependent published outputs, not just a seed or mutable cache.
Packages include originals, editable stacks, routing, dependencies and lossless
prepared results required for current and retained revisions. Existing playback
and undo work without the donor model cache; changing settings may require
explicit preparation. Slice 22 proves retention, 24 bounds storage and work.

## Verification owners

- [03b](slices/03b-processing-targets.md): target forest and sibling order.
- [03c](slices/03c-processing-stacks.md): pure get/set, stateless lifecycle and
  replacement semantics. [04](slices/04-projects.md) publishes the shared API.
- [05](slices/05-compiler.md), [08](slices/08-audio-mixing.md),
  [15](slices/15-layer-geometry.md), [16](slices/16-keyframes.md): execution,
  combined-result semantics and supported animation at every target scope.
- [12c](slices/12c-noise-reproduction.md) freezes local denoising; [15a](slices/15a-noise-processing.md)
  adopts the winner with production-entry parity. Neither blocks first preview.
- [22](slices/22-portable-projects.md), [24](slices/24-scale.md),
  [25](slices/25-agent-acceptance.md): portability, bounds and real agent use.

Noise acceptance needs noisy narration, clean controls, known-noise mixtures,
protected speech and independent listening for consonant loss, pumping and echo.
Retain raw outputs and separately labeled loudness-matched auditions; a lower
noise floor or ASR agreement alone is not naturalness proof. Include post-retime
speech and combined overlapping inputs, since those are the real stack inputs.
Denoising and adding room tone remain independent agent choices.

### Selected resampling context

Resampling filter input is restricted to current retained source support. The
compiler derives maximal runs contiguous in both source and project time on the
same track, with the same asset, stream, rate and pitch policy. Source acquisition
and ancestor availability holes break runs. Clip IDs and post-resampling gain do
not: a pure split preserves the domain, while a trim or removal changes it. No
persisted lineage or original-selection envelope survives an edit.

Compiled audio `context` contains exact `source` bounds and absolute output `sampleRange` bounds for relevant runs,
without clipping their bounds to the requested output window. The manifest carries
the same context for dependency identity. Native resampling intersects these
domains with proven occupied source segments; excluded PCM must never enter the
filter, even if decoding must seek through it. Synthetic edge padding is permitted.
The compiler floors full-run project endpoints in the requested output sample clock.
Native code consumes that origin directly rather than reconstructing it from a
window or split clip. Frozen nearest-source-start and ceil-source-end decoding
remain native rules; context adds no editorial clock.
This permission is specific to resampling, not context for authored DSP steps.
Slice 08 must prove split/window parity, boundary isolation and fractional-phase
readiness through real decoded samples; compiler domain conformance alone does not.
