# Independent layer arithmetic evidence

The [runner](../../../../packages/test-harness/editing/blend-sheet.mjs) submits explicit
surfaces through the public composition compiler and native frame/video operations.
The [reference](../../../../packages/test-harness/editing/blend-reference.mjs) implements
[W3C separable blending and source-over](https://www.w3.org/TR/compositing-1/#blending)
without importing the product renderer. It decodes sRGB operands before premultiplied
linear-light arithmetic and encodes the result as sRGB. Existing delivered-PNG and
movie display readers remain the observation owners.

[Requests/results](report.json) freeze the OS and worker identity, authored documents,
native receipts, source/output hashes and numeric masks. The runner's help owns
invocation. This proves the public compiler/native seam, not service/CLI admission.
No user media was changed.

Accepted full-raster PNG comparisons differ by at most one RGBA level; both decoded
movie samples differ by at most four levels against the reference and still output.
PNG limits apply everywhere. Movie patch comparisons exclude two pixels beside hard
patch boundaries because chroma subsampling mixes adjacent colors; the smooth vignette
excludes nothing. Limits were set before observing results. The retained
[patch-vignette failure](historical-patch-vignette-failure.log) led to a smooth source
control, not a relaxed threshold. Deliberately removing uncovered-alpha arithmetic or
substituting normal for the requested multiply mode makes the checks fail.

[Native-scale comparison artifacts](comparison/) and the supplementary
[4× nearest-neighbor sheet](comparison-sheet-4x.png) preserve actual output. Sheet columns
are normal-before, arithmetic reference, native PNG, first decoded movie frame; rows
follow the runner's case order. Still boundaries match the reference. Movie boundaries
show visible codec color mixing, outside the interior numerical claim. The vignette's
complete falloff matches its reference.

Numerical checkpoint: passed. Fresh unprimed visual critique, independent code-review
completion and public CLI/service admission remain open; this record does not close
those gates or the whole slice.
