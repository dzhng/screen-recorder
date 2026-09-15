# 09 — Arbitrary clean frames and media excerpts

Status: not started. Dependencies: 03, 05, 06.

Read [architecture](../architecture.md), [contracts](../contracts.md), and
[verification](../verification.md) before implementation. Commands below are planned
harness entrypoints to create in this slice, not existing executable claims.

## Contract and API seam

An inspected revision can produce a clean frame or audio excerpt for a requested playback range.

Implement core source-span lookup and native AVFoundation decode. Return actual decoded timestamps, size, crop and revision metadata. Respect half-open cut boundaries and never decode a removed neighbor. Provide narration/system/mix audio excerpts. Introduce bounded frame workers and derivative cache; no trail overlay or index-selection heuristics yet.

## Runnable checkpoint

Run bun run lab:frames on numbered source frames with edits, sparse static media and pauses. Request start, near-end, exact cut boundaries, cropped/full-resolution frames, repeated frames and audio clips across cuts. Decode and compare known visible frame numbers.

## Acceptance

Actual/requested time is explicit and meets available-frame tolerance. Requests at duration or outside bounds return a structured error. Clean output has no pointer burned in. Cache replay is observed; long-file random access avoids whole-video decode. Audio uses the same spans as frames.

## Decisions delegated and scope firewall

Decoder seeking internals and image encoder choice within PNG/JPEG support are delegated. Limits and coordinate contract stay fixed. A temporary source cursor cannot be erased with inpainting.

## Visual review

Clean frame fidelity/readability only. Compare known grid/cropped frames with source reference, then screenshot-critique last. Audio excerpts require audition.

Follow the exact skill links and non-blocking human review procedure in
[verification](../verification.md#visual-gates). If this slice produces no visual
artifact, retain its machine-readable evidence instead; do not manufacture UI just
for a screenshot gate.

## Stay green and feedback

Keep dependency slices' focused checks green. Update this slice's status/evidence
and the README Next Agent Prompt at each green checkpoint. Tests must pin consumer
behavior, not implementation constants. Run the narrowest relevant checks during
iteration; full-suite closeout belongs to slice 15.

If the source contains an unavoidable burned cursor, revisit capture configuration instead of faking clean output.

