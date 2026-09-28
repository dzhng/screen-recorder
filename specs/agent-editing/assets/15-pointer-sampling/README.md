# Exact source-time pointer sampling

`PresentationPointerHistory` owns the event merge and reset transitions used by
both legacy pointer schedules and requested project instants. Sampling advances
through real presentation, cursor, pause and geometry events up to the requested
source instant, then calls the existing trail eligibility planner with an explicit
trail duration. Lookahead reads the next timestamp without evaluating future
geometry or cursor eligibility. Physical support remains exact; observation queries
retain their integer cutoff independently of the selected picture's timestamp.

The input history belongs to the immutable source. A clip beginning midway through
it can show earlier trail observations; no clip trim is passed as a reset. Held or
repeated source instants preserve pointer state and age. Backward requests restart
forward readers, preserving event and occurrence budgets across replay. This keeps
retained memory bounded without inventing a whole-source raster index. Preparation
should normally feed source-ordered work; frequent backward sampling consumes the
explicit attempt budget and may refuse rather than run indefinitely.

[Verification](./verification.json) includes frozen legacy schedule byte parity,
positive source-time tests and controls that deliberately break lookback and replay
budgets. This prerequisite does not publish prepared overlay files or draw pointer
pixels. The immediately following vertical pass must write a bounded attempt-local
stream, retain source/cache lifetimes, validate enabled-step correspondence and
replay compiler geometry through the shared native executor. Execution stays unbound.

[Combined integration checks](integrated.txt) pass all 36 trail/history tests after
merging the public frame-visibility change. [Service render checks](service.txt)
pass 18 tests with two pre-existing skips; [all seven type/build tasks](types.txt)
pass. Native execution remains a separate gate.
