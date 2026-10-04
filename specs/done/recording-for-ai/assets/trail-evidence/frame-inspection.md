# Annotation jobs in the frame inspector

The [frame tests](https://github.com/dzhng/screen-recorder/blob/9971437d1c1c6f0e31694ddd83212b851349eb81/packages/core/src/frames.test.ts) run the real revision
store, queue, derived cache, source processing, evidence index and trail planner.
Only native exporter, visual sampling and final decoding are supplied seams. This
proves core behavior, not the delivered pixels; public rendered acceptance remains
with the owning slice.

## Evidence

Omitted clean uses the two-second annotation policy; clean bypasses source evidence,
and pointer-only has its own rendering identity. A legitimate empty overlay remains
clean:false with missing-cursor reason. The native receipt must match planned point
counts/timestamps, selected video time and source dimensions. Nil receipt timestamps
are normalized because Swift Codable omits those fields rather than emitting null.
Missing geometry and mismatched final image/receipt never become cached successes.

Complete batch option/time validation precedes both source and frame admission.
Valid duplicate inputs preserve ordered results while sharing their durable job.
A requested newest take enters source processing ahead of older unadmitted history,
using the existing queue and background capacity callback. Removing targeted source
preparation made the order regression fail; restoring it returned green. Preparation
is idempotent and leaves a failed source failed until explicit source retry.

An in-flight annotation retains its original revision and source generation across
an edit and a separate source reprocessing attempt. A subsequent request uses the
new generation in a different job identity. Eviction regenerates the same pinned
request; cancellation removes even a late decoder output and never publishes it.
Public canceled-artifact readiness remains not_requested with reason:canceled,
matching the established queue contract. A native decoding failure stays failed
until explicit frame retry; that retry preserves its source generation.

Original fixture media remains unchanged. Reverting the default to clean made the
default/dependency regression fail. Public metadata contains no RGB payloads or full
trail point arrays; the native rendering plan stays internal while the core returns
one compact projection shared by all adapters.

## Review boundary

The shared frame owner adds no queue, catalog table, transport operation or alternate
trail algorithm. The required annotation dependencies are explicit in its constructor.
Source generation/integrity and scene/trail policy identities are pinned in job
options. Public metadata carries source identity/integrity plus useful sampled
coverage; it does not duplicate the raw evidence already available elsewhere.

Verification: all 18 frame tests and all 137 core tests pass, with core build/type
checks and focused lint/formatting. Independent Codex review passed the frame tests
and identified the required six-argument constructor wiring in the production
service. That service change is owned by the concurrent integration pass; this core
checkpoint alone is not an application-build or public-rendering acceptance. The
combined tree must pass service/application checks after that wiring lands.
