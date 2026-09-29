# Repeated fragmented-source selection

The actual package stress setup committed its first500-place batch after its public
10-second request timed out. This checkpoint addresses composition work before
package export; the combined public journey remains open.

Replaying that exact committed document with its actual100,000 source fragments
and acquisition mask took23.47seconds in the original model and145milliseconds
with shared support resolution and indexed selection. Complete resolved values
match the same SHA256. The representation stores stream metadata once in assets
and stream identities on clips, avoiding duplicate serialization of the same
objects; no timing or availability rows are dropped. All500 clips/5,000 selected
intervals remain. A scratch attempt to stringify the entire shared object graph
hit Node's string-size limit; that was a diagnostic serialization error, not a
product edit failure or a changed acceptance threshold.

A separate synthetic narrow-selection profile measured8.30seconds initially,
5.76seconds after shared-object freezing alone, and61milliseconds after support
selection. These are observations under concurrent work, not universal latency
budgets. The profile points to repeated support conversion/allocation and repeated
traversal of shared stream metadata. Scratch RSS includes fixture loading and
result serialization; it is not a per-call allocation estimate.

Support is now resolved once per stream/acquisition pair during one validation.
A lower-bound search enters sorted half-open support at the selected source time;
only intersecting intervals are mapped. Freezing visits each shared object once.
There is no persistent cache or change to source, acquisition, anchor or rational
clock semantics.

All234 composition tests and the typecheck pass. Focused tests cover distinct
acquisition masks on repeated media, fractional endpoints, gaps and touching hold
boundaries. Changing the search's endpoint comparison deliberately fails the hold
boundary test; restoring it passes. Independent scoped Codex review found no
concrete regression and ran both focused tests.

The archive retains exact inputs, complete normalized resolved output, original
model source, matched measurements, profiler and verification logs. After extracting
to a scratch directory, the existing built composition library can reproduce the
model result using `sparse-selection.mjs --input INPUT --out NEW --expected DIGEST`.
The manifest authenticates every retained file. Public setup, package transfer and
adopted history still require the integrated follow-up.
