# Revision-bound public frame inspection

Status: implementation started. Native decoding is already verified; this pass
connects it to the shared core, public operations and actual client image delivery.
Parent slice 09 remains open until frame and audio inspection gates pass.

## Owners and invariants

The core pins the requested revision before asynchronous work and resolves edited
time through the existing timeline owner. Native receives only the retained source
interval. A concurrent edit cannot move an admitted request onto a new revision.
The response distinguishes requested/actual source and playback time.

The existing durable queue owns concurrency and attempt publication. Cache misses
must create a fresh attempt of the same pinned request; ordinary retries of a ready
artifact remain idempotent. A stale cache-miss observation cannot discard a newer
published generation.

A core cache owns only disposable derivatives in its dedicated root, with the
contract's 1 GiB LRU budget. Source media, transcripts, edit history and selected
index evidence are not cache candidates. An acquired read must survive eviction
pressure until released. Restart/missing-file reconciliation must repair accounting
without turning cached job metadata into a permanently unreadable ready result.

## Vertical acceptance

- Real numbered video through the public service: start/end, exact cut join, sparse
  samples, crop and full-resolution output, with requested/actual timing metadata.
- Hold a decode across an edit; result stays pinned and a new current request sees
  the new revision. Missing-file/LRU eviction regenerates only the named generation.
- Cache replay avoids another decode, including after restart. Two frame workers
  maximum; no second queue or semaphore. Failed attempts require explicit retry.
- CLI delivers a usable image file and MCP includes actual image content with
  matching metadata/bytes. A local path alone does not satisfy MCP image access.
- Source bytes remain unchanged, and cancellation cannot publish stale derivatives.
- Inspect delivered images and run independent visual critique before acceptance.

## Dependency boundary

Default pointer/trail frames still require real pause/geometry/scene boundary
production and core sample selection in slice 10. Do not silently return clean
frames for the final default request. A staged clean-frame capability must require
an explicit clean request and stay marked partial until normal defaults work.
Audio excerpts, batch frames and the named frame harness remain part of parent
slice 09, not waived by a single-frame checkpoint.

## Queue regeneration checkpoint

The durable queue can regenerate only the ready generation named by a cache-miss
observer. It reuses the pinned revision and advances the attempt generation,
atomically removing the obsolete publication. Queue saturation leaves the existing
publication intact; stale observers cannot invalidate a newer attempt. Ordinary
retry of a ready job still returns the same result.

Nineteen queue tests pass, including edit-between-attempts, stale invalidation and
admission rollback. Core build/typecheck pass. Independent Codex review reported
no actionable defects and independently ran those 19 tests. This is a queue
primitive only; cache and public frame integration remain incomplete.

## Current implementation pickup

Explicit clean single-frame requests now run through the public service, CLI file
output and MCP image content. The [checkpoint evidence](../assets/frame-delivery/review.md)
records real own-window recording, matching client pixels, crops, historical/current
revision separation and immutable source hashes. The shared registry owns frame
request/retry and bounded artifact read/close operations.

Delivery holds an acquired cache reader for a fixed lifetime, transfers bounded
chunks, and releases on completion, failure or expiry. Large images do not travel
inside one metadata response. The CLI accepts an explicit output path or creates
a temporary image file; it never overwrites an existing output.

Next: frame batches, audio inspection and the default trail dependency. The parent remains open. Do not
claim default trail frames, full public-frame acceptance or actual model-level MCP
visual inspection from this clean single-frame checkpoint.

The generated sparse-source coverage pass adds public start/end/earlier-tie checks,
full 2048×1152 CLI/MCP pixel equality, exact cut joins and genuine LRU eviction
followed by pinned historical regeneration after app restart. The delegated fresh
app build and two-test pair passed. Root reran this test with the clean-frame,
source-processing and timing tests after source-evidence integration; all four pass. This adds no batch or trail claim.
