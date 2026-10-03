# Physical segment capacity

The existing 100,000 occupied-run capture capacity can require 200,001 physical
probe rows: one row per occupied run, 99,999 inter-run gaps, and both edge gaps.
The shared AssetStore media schema now admits that physical-row count for all
imports. It preserves every empty row, clock and media mapping; it does not invent
a second canonical-only metadata format or change occupied support normalization.

The boundary regression failed under the old cap and passes with the new bound.
It checks exact persisted rows, exact resolved occupied spans, and refusal one row
above capacity. All 16 AssetStore tests pass. The actual banked 100,000-run capture
has 200,000 rows and now reaches ready through a fresh public acquisition request
in 63.406 seconds. Its earlier failed request remains an immutable replay.

The same measured metadata takes about 43 ms to read/decode, 57 ms for the strict
schema, 154 ms for owned copying/admission/SQLite publication, 71 ms for a stored
read plus exact comparison, and 6 ms for composition resolution. Observed process
high-water RSS is about 390 MiB, including simultaneously retained raw, validated,
stored and comparison objects; it excludes the native worker and is not a universal
memory guarantee. `verification.json` retains per-phase measurements and commands.

This closes the physical-row admission prerequisite only. Public full asset reads
and embedded package metadata still exceed their unchanged transport/manifest
budgets. Their reference/page delivery remains open, as does complete large-input
capture rollout. Complete native metadata is retained in
[the transport prerequisite](../20d-probe-file/README.md).

[Combined-root verification](root-verification.json) confirms the exact boundary tests and actual fresh public acquisition with same-job replay. Its retained report and logs are in `root-verification.tar.gz`.
