# Retained index orchestration — core checkpoint

IndexProcessing composes the existing dependency processors, selection stream,
shared frame materializer and retained store. It owns job admission/publication;
none of those collaborators grows a second queue. Missing dependencies return
readiness before a frame slot is occupied. A failed dependency requires its own
explicit retry.

The single background index reservation includes canceled executors until they
actually settle. This matters when a native decoder has received cancellation
but still owns resources: a second producer must not consume the foreground slot.

## Evidence

The merged core suite passes 197 tests; build, types and focused lint pass.
The new real-catalog orchestration tests cover dependency waiting, pinned historical
selection/coverage after edits, a held canceled decoder with simultaneous foreground
completion, partial-render failure with explicit retry, and failed-source isolation.
Their native exporter/decoder seams are generated fixtures; the tiny PNG verifies
file lifetime, not raster fidelity or visual usefulness.

Removing the active-executor reservation made the cancellation test fail because a
second index was admitted while the first decoder remained held. Restoring it
returned green. Independent Codex review found no actionable orchestration defects;
local shape/diff review keeps lifecycle ownership in the queue and retained store.

Public paging/delivery, restart through the bundled service, actual native retained
images, contact-sheet readability and thirty-minute index performance remain in 11c.
