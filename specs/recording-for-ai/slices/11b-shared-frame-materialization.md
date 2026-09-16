# Shared frame materialization for retained evidence

Status: implemented; [verification](../assets/frame-delivery/materialization.md)
covers shared materialization and unchanged native output. Retained index delivery
remains in 11c. The render-to-explicit-output operation is shared with FrameInspection. One owner maps the pinned revision, plans
trails, decodes and validates actual image/overlay receipts. FrameInspection keeps
queue admission, cache reservation/publication and cache metadata. No second renderer,
native selector, timeline mapper or scene detector.

The shared seam accepts pinned revision/source evidence, effective frame options,
output destination and AbortSignal, and returns the current validated image metadata
without a disposable cache ID. Retained index production can use it directly later.
No queue waiting, nested frame jobs or cache-file copying belongs in this operation.

Preserve every existing clean/annotated frame contract, error and cancellation cleanup.
Test the same native receipt mismatch, retained cut selection, source generation,
clean bypass and explicit empty overlay behavior through FrameInspection. Re-run actual
public trail/batch/audio gates and compare retained baseline image bytes. Any changed
pixels need comparison and fresh screenshot-critique before acceptance.

This slice changes ownership, not styling, frame policy or public API. Name and
internal type layout are delegated; avoid exposing cache lifecycle in the shared seam.
