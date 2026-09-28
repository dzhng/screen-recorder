# 10d — Direct project frames and retained screenshot inspection

Status: in progress; compiler/core picture planning and native extraction are implemented. Public project/source pictures and retained indexes pass their native journeys and fresh inspection checks; raw still-image inspection remains open. Public selected-acquisition gaps are verified through audio-anchored video; direct custom video-mask admission is outside the current capture producer. Corrected common-profile references pass limited fresh visual review. Dependencies: [09](./09-first-preview.md), [10b](./10b-source-acquisition.md), [10c](./10c-occurrence-queries.md).

## Contract

An agent receives source/project frames and retained screenshot-index results with
correct occurrence, time domain, revision and generation identity through CLI/MCP.

## Seam and ownership

Source frames use the existing selected-source decoder. Project frames consume the
compiler's globally phased picture instructions and the same compositor as movie
previews; do not render and decode a temporary MP4 to obtain a still. Extract only
the reusable compiled-picture execution boundary from the existing native owner.
Readiness/capability binding is shared with preview and later audio inspection.

Retained screenshot selection/index keeps its existing lifecycle and bounded
readers; project coverage uses the occurrence-query owner. Jobs, cache, delivery
and deletion remain the shared owners from 09.

## Work and review surface

Extend existing frame/index registry operations with flat source/project selectors.
Return declared sampling/visible times and exact context pins. Source indexes remain
raw-source evidence; a processed project frame is explicitly distinguished. Gaps,
holds, unavailable acquisition and repeated uses retain their identities.

```sh
node packages/test-harness/editing/frame-evidence.mjs --fixture repeated-picture
```

## Acceptance

Delivered still membership/timing matches verified preview/export for boundary,
interior, held and leading partial pictures, repeated/reordered sources and selected
acquisition gaps. Use asymmetric landmarks to verify orientation/framing. Test
paging/index coverage, source-generation changes, eviction, cancellation, deletion
and cross-transport delivery. Unsupported processors/profiles refuse consistently
with preview. Existing recording/package frame/index gates remain green.

## Visual acceptance

Judge picture membership and framing in contact sheets and boundary crops, not
new styling. Compare against the named preview/corpus using compare-screenshots;
run a fresh unprimed screenshot-critique as the final visual check. Retain hashes,
shots and verdicts. Human review is non-blocking under the spec's standing review
procedure; no listening or broader codec-quality claim follows from stills.

## Failure boundary and discretion

Do not create a second layer/transform interpreter or bypass source availability.
Pointer execution and broader output-profile acceptance remain their named later
gates; static geometry is verified under 15.

Delegated: extraction of the coherent native picture executor and index storage
representation. Sampling, capability, identity and single-owner rules are fixed.
Update slice Status and the README handoff after verified passes.


## Current pickup

Complete raw-image public frame delivery, then project still composition and its
retained indexes. Reuse the native still owner below, retain truthful timeless
image provenance, and verify actual CLI/MCP media and lifecycle. The public timed
picture/index and acquired-gap checkpoints already pass; do not restart them as
unimplemented features. Preserve their existing journeys when changing shared
owners. Whole-slice closure still requires reconciling every acceptance item.

## Established evidence

[Compiler picture planning](../assets/10d-picture-window/README.md) and
[core lifecycle](../assets/10d-project-frame-core/README.md) are prerequisites.
[Native extraction](../assets/10d-native-pictures/EVIDENCE.md) and
[public project pictures](../assets/10d-public-project-frames/README.md) supply
actual delivered media. The common profile references received limited independent
visual review; this does not establish broad codec/color quality.

[Selected-source extraction](../assets/10d-source-frames/README.md),
[public routing](../assets/10d-source-routing/README.md), and
[actual source delivery](../assets/10d-source-frame-public/README.md) verify
stream selection, physical gaps, provenance, retry and retained acquisition
lifetime. [Physical no-picture observations](../assets/10d-source-empty-observation/README.md)
distinguish a demanded empty sample from decoder failure. [Fresh frame skill use](../assets/10d-frame-skill/README.md)
checks an external consumer. Raw images remain the distinct next public path.

[Scene ownership](../assets/10d-scene-ownership/README.md),
[selected-source sampling](../assets/10d-source-scene-sampling/README.md), and
[actual source/project scenes](../assets/10d-public-scenes/README.md) retain
physical clocks and measured before/after observations.
[Fresh scene skill use](../assets/10d-scene-skill/README.md) verifies occurrence
coverage and explicit dependency recovery. Authored project cuts belong to
[10c](10c-occurrence-queries.md), not the visual scene detector.

[Retained index ownership](../assets/10d-index-ownership/README.md),
[source selection](../assets/10d-source-index-selection/README.md),
[queued source production](../assets/10d-source-index-jobs/README.md), and
[service integration](../assets/10d-source-index-service/README.md) lead to
[actual source-index journeys](../assets/10d-source-index-public/README.md).
The latter verify paging, batch images, short physical islands, retry and retained
history/restart; controlled empty-admission cases are labeled separately.
[Fresh source-index skill use](../assets/10d-source-index-skill/README.md) verifies
the public recovery/read workflow.

[Compiler frame boundaries](../assets/10d-project-index-clock/README.md),
[project candidate selection](../assets/10d-project-index-selection/README.md),
[retained project ownership](../assets/10d-project-index-domain/README.md), and
[queued materialization](../assets/10d-project-index-processing/README.md) support
[actual public project-index journeys](../assets/10d-project-index-public/README.md).
Those delivered-media checks include empty/background projects, dry/processed
taps, cancellation/retry, complete coverage paging, historical reads and deletion.
[Fresh reinspection](../assets/10d-frame-visibility/README.md) resolves the earlier
public range ambiguity without changing PNGs. [Combined native verification](../assets/10d-inspection-integration/README.md)
preserves these paths alongside still decoding and the acquired-gap fix.

## Project retained-index selection contract

Project indexes use the same video taps as direct picture inspection, defaulting
to processed output. Identity pins the revision, normalized tap, image size,
renderer, selection policy and exact source-scene generations. Whole-project
selection is the first public contract; a tap supplies scope without a second
independent track-filter language.

Select first/last project frames, the existing five-second representative cadence,
and compiler neighbors around authored clip and availability boundaries. Authored
edges remain reasons even when continuous source mapping suppresses an editorial
cut: separate clip stacks can still change the picture. Source changes contribute
both actual observed request times through the occurrence projection owner; never
invent the before side as event time minus one microsecond. Select at-or-before
the earlier projected observation and at-or-after the later one, including an
exact sample on either side. Omit a side when its quantized frame leaves that
occurrence's available fragment; do not substitute another clip or a source gap.
Keep both original and projected observation times in the reason. Deduplicate
through compiler frame identities, retaining all reasons. Holds and background
periods retain authored/periodic candidates even without advancing source evidence.

Render each selected candidate through project picture inspection. Source PNGs and
source stillness cannot establish processed composite output or justify dropping
periodic candidates. A missing source picture can still produce valid background
or another layer. Mark only delivered frame visibility as sampled; intervening
intervals remain unproven, with source/occurrence availability reported separately.
An empty project has no candidates or coverage; an audio-only nonempty project can
have background pictures. No fabricated one-microsecond request admits an empty
project.

[Pure candidate selection](../assets/10d-project-index-selection/README.md) implements
this policy with bounded work and cancellation. Candidate visibility is a timing
plan, not proof that a PNG was delivered. [Retained project ownership](../assets/10d-project-index-domain/README.md)
validates identity, PNG receipts, exact sampled coverage and store lifetime.
Preparation and frame materialization now retain multi-source scene dependencies
through indexed job references. Reclaim retained project indexes
through the existing deletion owner after work drains and delivery leases are
revoked. Public routing and real CLI/MCP/native journeys now verify those owners.
Selection/reason budgets refuse explicitly rather than truncate; slice 24 owns
release-scale measurements. Before rendering, the producer must call the shared
record preflight, including a heavily overlapping frame regression.

Processing is currently constant. When [16](16-keyframes.md) adds windows/curves,
its composition temporal owner must supply their boundaries to this selector;
inspection must not invent another anchor/curve interpreter. A short activation
between periodic samples must get candidates before temporal processing is accepted.


## Retained production and lifetime

The shared record encoder preflights all candidate bytes before rendering.
Source and project scene dependencies use normalized job-input references, kept
through retryable failure and older active attempts until they drain. Successful
retained PNG publication releases preparation inputs; readers use the stored
generation's pins without requiring current scenes or renderer availability.
Catalog format 12 refuses earlier development catalogs missing these semantics.

The existing deletion owner reclaims retained project indexes after active work
and delivery leases drain. There is no second cleanup worker. Public native
journeys verify open-delivery revocation, external copy preservation and unrelated
project survival. Native frame receipts still validate the full compiled graph;
public and retained receipts omit renderer-private execution coordinates.

## Public frame visibility

Direct and retained project picture receipts use the compiler's complete global
frame visibility interval, clipped only by the project end. The request instant
remains `atUs`; it is not a visibility window. Native execution still receives
and validates the original demanded window before this public projection. At
10 fps, a clip authored to enter at 2.25 seconds first appears in the 2.30-second
sample; the base-only 2.20-second sample remains displayed through 2.30 seconds.
This distinguishes authored intent from sampled output without another clock.
The project-picture recipe advances to v4 because cached metadata changed; native
pixels, source-picture identity and movie windows are unchanged.

## Timeless still-image native prerequisite

[Native image evidence](../assets/10d-still-image-native/README.md) pins a shared
PNG/JPEG metadata, orientation and bounded-decode owner. Image delivery carries
identity, oriented dimensions and alpha without a fabricated sample clock. Import
and raw rendering refuse incomplete images and animation consistently; the
existing timed video frame path is preserved. This is internal preparation only:
public source and project still rendering must consume this owner, preserve image
identity through cache/delivery, and pass actual CLI/MCP/native journeys before
advertising support. [Fresh fixture-scoped visual review](../assets/10d-still-image-native/visual-review.md)
passes; the root native integration journey also passes.

## Public acquisition-gap picture acceptance

[The public acquisition-picture journey](../assets/10d-acquisition-pictures/README.md)
verifies delivered project pictures, retained indexes and preview across an audio
parent's selected acquisition gap, with identical footage under full-context and
physical-only controls. Source video stays readable; project provenance correctly
identifies ancestor exclusion. Donor deletion, historical reads and restart retain
these distinctions.

This is the original selected-acquisition-gap acceptance gate, using existing
public admission and attachment semantics. The earlier “custom video masks” TODO
was broader than that contract. Direct narrower video-source masks remain
native/core-only: public admission uses physical video support. Any future public
captured-video support producer belongs to 10b and needs authoritative acquisition
evidence; no arbitrary mask-authoring API is inferred by 10d.
