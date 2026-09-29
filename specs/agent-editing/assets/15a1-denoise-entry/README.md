# Frozen learned native-entry parity

The isolated [native dependency](../../../../helpers/denoise/README.md) reproduces the frozen mono RNNoise output through its typed streaming adapter. All 25 complete-byte comparisons pass: retained original and independent clean/reference/noise mixtures, arbitrary small input chunks, first/interior/end and tiny sample counts, and discriminatory timing/state controls. This is native-entry parity, not public processor adoption or listening acceptance.

The same pinned source/model, normalization, partial-frame padding, two flush frames and 960-sample compensation are preserved. Every vendored source/header byte matches the recorded git revision or model archive; COPYING is exact. Only 240,048 bytes across 29 upstream source/header files are vendored. The 78,003,012-byte generated model source is explicitly staged from the existing hash-pinned local archive, never downloaded or committed. Full product distribution/model preparation remains a later gate.

## What was verified

The unchanged adapter completed a clean isolated scratch build in 99.40 seconds wall time, including a fresh Swift module cache. Later test-caller cleanup changes rebuilt incrementally; the final retained run passes all comparisons and named refusal/cleanup checks. This measurement is not repeated app-build cost. With new model staging absent, the unchanged existing macOS ScalarTests product built and its existing cross-language harness passed 11 vectors / 7,023 samples. Ordinary app dependency closure excludes this isolated package. A broad app/native suite was not repeated.

A deliberately wrong 480-sample compensation fails the original-reference byte comparison; restoring 960 returns the complete suite to green. Unsupported rate/stereo, empty input and nonfinite samples produce named refusals. Late nonfinite data and cancellation after output begins leave no published or staging file. Read/write/cancellation callback errors propagate; state cleanup follows the adapter's defer. This is not measured leak/OOM recovery: the unchanged upstream allocator does not guarantee recoverable allocation failure.

Selection checks supply already selected bytes to the adapter. They prove input/state ordering and expose process-before-selection and reset-per-piece mistakes; they do not prove future public source-selection integration. The existing compiled-selection research remains separate evidence. No channel linking, strength, transition, retiming, general target semantics, preview/export substitution or model-aware queue behavior is inferred.

## Review and retained evidence

The initial independent static review found three test-caller/harness defects: partial output on failure, accepting any nonzero refusal exit, and incomplete failure diagnostics. They were fixed with success-only file publication, named error assertions including late failure cleanup, and immediate identity/command/timeout persistence. The initial failed include build and the build invalidated by editing a compiling test are retained as workflow failures. Frozen numeric failures were not removed or weakened.

The [evidence archive](evidence.tar.xz), checked by [SHA256SUMS](SHA256SUMS), retains complete PCM with content deduplication, command reports, original and follow-up review, successful and failed build logs, the deliberate mutation and restoration, model/source verification and the existing native test result. `manifest.json` maps every original artifact name to its stored member and exact SHA-256; duplicate bytes remain addressable. No new audition or visual was produced. The [review resolution](review.md) distinguishes independent static review from executed gates.

The [pre-implementation audit](adoption-audit.md) records why adoption was resliced. Remaining work follows [15a2](../../slices/15a2-denoise-prepared-consumers.md) and [15a3](../../slices/15a3-denoise-acceptance.md). The parent retains the full contract. The user's learned preference remains, and later no-obvious-artifact feedback still does not establish intelligibility or word retention.

## Combined-root confirmation

The [root receipt](root-verification.json) verifies the final named adapter at
bd54f149. Explicit local model staging and a fresh package build passed; the build
reported143.18s under the observed load. All25 parity/control comparisons and
named error/cleanup checks passed in5.93s. All54 emitted PCM files match content
already retained in the evidence archive; all372 archive mappings to85 unique
objects were verified. Root logs and the complete report are retained compressed.
This adds no public readiness or listening verdict.
