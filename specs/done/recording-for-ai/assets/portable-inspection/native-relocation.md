# Native inspection after relocation

[Machine receipt](native-relocation.json) comes from the optional
[generated lab](https://github.com/dzhng/screen-recorder/blob/cc5d7a9fee578758eeadffe662eff0778556d7df/apps/macos/tests/package-relocation.mjs). It pins its
native executable hash and source revision. The original library and media are
removed before a fresh child opens moved source, scene and retained-index readers.
No capture device, user media, library reconstruction or analysis cache is used.

The production queue creates the retained index first. The test then chooses an
unselected timestamp and compares full frame metadata, decoded pixels, WAVE bytes,
retained image bytes, scene chunks and coverage. It checks an older pinned edit
with later history preserved, clean/annotated requests, a scene cutoff, pause and
geometry resets, sparse actual-frame timing, and a narration gap while system
audio continues. All packaged input hashes remain unchanged. Native calls use the
production worker owner, whose promise settles after child and pipe closure; the
fresh reader process also closes before cleanup.

The target is a readable generated browser screen with the same pixels and cursor
history after relocation. [Annotated](relocation-annotated.png),
[clean](relocation-clean.png), [after-pause](relocation-pause.png) and
[historical](relocation-history.png) captures form the complete set. The numerical
oracle is exact decoded RGBA equality, not a tolerance or a chosen visual baseline.
It also checks nonzero trail observations and independently measures the two
synthetic audio frequencies through the acquisition gap.

Fresh visual review found no clipping, obvious overlay misplacement or corrupt
pixels. It noted low contrast in the generated deployment banner and jagged/dark
edges in nearest-neighbor enlarged cursor crops, much less visible at full size.
Those presentation limits are retained here: this checkpoint proves relocation
parity, not source-color or enlarged-overlay quality. The images contain generated
bitmap text and shapes rather than a captured browser.

Portable corruption tests include required-member loss, altered PNG bytes,
unsupported policy/context, and rehashed malformed scene timing. Scene payloads
reuse append's exact sample-grid/distance/order/comparison checks. Removing a
candidate coverage filter reproduces a page-parity failure; dropping portable pause
markers reproduces a native metadata/pixel mismatch. Independent code review also
found an evidence-hashing CWD assumption; the package-script invocation reproduced
the failure, and hashing now resolves from the repository root.

This is an internal generated-directory result. It is not a ZIP containment,
public CLI/MCP package-handle, accepted narration/transcript, or complete export
result. [14b3](https://github.com/dzhng/screen-recorder/blob/2e1028cddc3f89d58018a4ebcbc8895b28a78ae1/specs/recording-for-ai/slices/14b3-retained-inspection.md) owns those remaining gates.

[Main-checkout relocation](merged-relocation.json) independently reruns the lab
against the rebuilt app after movie/presentation integration and shared full-audio
planning. All 269 core tests also pass in the [merged execution log](merged-core-tests.txt).
The [bundled public index check](merged-public-index.txt) also passes retained
image delivery through the public adapters across edits, cache eviction and restart.
All four merged relocation PNGs are byte-identical to the independently reviewed set.

The four-image human checkpoint ran in one Preview window from 21:20:25 to
21:25:27 UTC on 2026-09-16. No feedback arrived. The integrating reviewer accepted
the scoped relocation parity on exact byte/pixel comparisons and full-image
inspection, retaining the fixture contrast/edge limitations above. The review
window and its empty open dialog were closed afterward.
