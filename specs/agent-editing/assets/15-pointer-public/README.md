# Public pointer preparation

Project frames, previews, exports and retained indexes now admit captured pointer
history before occupying a render lane. The existing queue owns dependencies,
transient pressure, cancellation and bounded lost-history readmission. An index
holds source-history cache leases while producing frames, so its frame children
cannot wait for heavy preparation behind their own heavy parent. Readiness is
bound only when the renderer has the actual preparation owner.

The [public journey](../../../../packages/test-harness/editing/pointer-public.mjs)
uses authored capture observations, the real CLI/MCP service and native worker.
[Its report](report.json) retains cold nested admission, explicit cancellation and
retry, cache loss, restart, deletion, missing-observation diagnostics and inactive
or dry taps. The fault is removal of one scratch cache file while retaining its
published metadata; it does not mutate source media or a user's library.

Public geometry/opacity order renders match the previously
[reviewed native PNGs](../15-pointer-execution/README.md) byte for byte. Pure split
keeps pre-trim source history; hold freezes trail age; retime and duplicate match
the same source instants. Full/range prepared rows match exactly, including the
floor-selected first sample. The repeated movie's backward source replay produces
the same observed pointer state. These are public-route preservation checks,
not a new visual assessment or whole-movie color acceptance. The strict legacy
and thin encoded magenta-trail diagnostics remain red under
[slice06](../../slices/06-render-reproduction.md); no thresholds changed.

## Recovery and bounded progress

Only actual queue transitions request another coalesced admission turn. A new
nested deferred child and a terminal prerequisite both need this event: the parent
may already have been visited in the current snapshot. Unchanged reads or
retryable capacity pressure cannot generate wakeups. Removing the terminal event
fails both [negative controls](terminal-wake-red.log); the restored
[queue/history tests](queue-selection-history.log) also prove no repeated wakeups.
Permanent aggregate history size is checked using retained publication receipts,
including evicted files, so impossible source sets terminate instead of replacing
one another indefinitely. Limits remain provisional capacity guards, not slice24
release-scale measurements.

An explicit export retry repairs its pointer-preparation dependency or a returned
pinned renderer. It preserves the existing policy for unrelated decode failures:
those require explicit preview retry. A stale parent availability failure does
not grant permission to retry a newer decoder failure. Prepared cached or staged
bytes use the existing export input-readiness owner and can finish without the
old renderer; forcing an unconditional preview request fails the
[staged recovery negative control](staged-retry-red.log).

## Reproduction and review

Use the exact worker and module identities in [verification](verification.json).
The runner requires no capture, playback or download. Source pointer resets and
physical support remain owned by the previously proved
[exact history/sampler](../15-pointer-execution/README.md), not a second public
selector. Admission uses the compiler's discrete frame-boundary owner over exact
resolved availability, including fractional retime and ancestor gaps.

[Review disposition](code-review.md), [combined focused tests](combined-focused.log),
[pre-image broad preservation](core-service-before-images.log) and [type checks](types.log)
retain their respective scopes. The joint renderer recipes include image/video
receipt discriminants and pointer execution. No public capture fields, renderer
compatibility mode, new queue or new poller were introduced.
