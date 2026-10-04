# Catalog evidence stream for screenshot selection

[The adapter](https://github.com/dzhng/screen-recorder/blob/9971437d1c1c6f0e31694ddd83212b851349eb81/packages/core/src/selection-evidence.ts) merges bounded
catalog iterators into the selector's source-time event stream. It forwards the
full source, including removed intervals; the selector owns revision filtering,
cut sides and first/last candidates. Equal-time boundaries precede visuals, then
cursor observations retain ascending normalized sequence so the selector can use
the last duplicate observation.

Canonical scene comparisons already advance strictly in actual image time. A
separate ordered pass exposes their boundaries without another index or sorting
the entire recording. Visual coverage advances in requested time, dropping the
repeated predecessor at a chunk edge. A comparison is usable only when its two
actual image times match adjacent observations and lie within the current kept
span. A held image means zero difference only within that span. Removed frames,
first observations and unavailable comparisons remain unknown.

## Work and cancellation bounds

Each merge input retains one next event and at most one bounded page/window.
Cursor reads use the existing source-time continuation. Scene reads retain one
chunk. Inclusive timing reads use disjoint windows, preserve duration-edge pauses,
and retain the store's explicit excessive-density failure. Repeated confirmation
of a geometry epoch is not a reset; the first placement after an unknown prefix is.

Finding the first boundary can scan an entire static recording. This is extra
linear reading, not constant startup work. The thirty-minute real-catalog fixture
measured 40 ms before its first event on this host: 181 one-chunk scene reads,
362 timing windows and one cursor page. Timing is observed evidence, not a portable
performance guarantee. Empty scans yield to the event loop and check cancellation
between pages/windows. They never accumulate whole-source cursor arrays.

## Verification

The focused tests use real catalog stores and normalized source fixtures. They
cover duplicate timestamps across cursor pages, chunk overlap, sparse future image
times, cut-edge uncertainty, delayed geometry, explicit unknown cursor coordinates,
equal-time ordering, excessive timing density, identity mismatch, early iteration
and cancellation. A mutation allowing removed held images to prove zero difference
made the cut test fail; restoring retained-span eligibility returned green.

This adapter provides evidence to selection. It does not implement image publication,
contact sheets, public index delivery or physical cursor acquisition.

Build and core type checks pass. The full core suite passes 180 tests, including
eight adapter cases. Focused lint/format and documentation-link checks pass.
Independent Codex review found no actionable correctness or bounded-work defect;
it passed 45 focused tests and the core type check. This pure catalog pass does
not claim native or public-delivery verification.
