# Source transcript reads

Source inspection reads immutable transcript evidence in the asset's clock. Query windows select overlapping rows and mark clipped rows `partial`, while retaining each original `sourceRange` so an agent can still choose an accurate word boundary. No editing revision or project fragment is fabricated.

Recording, portable-package and direct-source readers share bounded ordered traversal and literal phrase scanning in [transcript-read.ts](../../../../../packages/core/src/transcript-read.ts). Source phrases stay within one inference segment: adjacency in a transcript is not evidence that speech continued across an unacquired interval. The recording reader retains its established projection and phrase semantics.

Continuations bind the selected asset, stream, explicit acquisition (or physical-only omission), transcript generation, support digest and query. Reusing one against a different identity or query refuses with `ARTIFACT_CHANGED`.

Verification exercises the actual neutral `TranscriptStore.ingest` and SQLite record reads, with fixture inference output. It is not native inference or CLI/MCP acceptance. The suite includes source-window clipping, one-row pagination with gaps, literal folded search, cross-segment phrase refusal, identity/query changes, a late indexed window, and bounded empty search continuation. Existing recording and portable-package reader tests run alongside it.

A proposed equal-start word fixture was rejected by the real ingestion invariant: words cannot overlap, including normalized one-microsecond instantaneous words. No storage invariant was weakened to manufacture that scenario. The shared ordered reader still retains its existing `[startUs, ordinal]` key semantics.

Removing the source segment boundary check produces the false `last first` match across the real stored acquisition gap, and the test fails. The check was restored before the final gate. A preliminary regex test used trailing punctuation that the established word-folding policy intentionally removes; the test now uses internal regex syntax to distinguish literal matching without changing that policy.

The initial page traversal used a longest-word lookback. That limitation is resolved by the [bounded seek pass](../10b-transcript-seek/README.md), which aligns portable nonoverlap admission with ingestion before using a predecessor lookup.

Independent Codex review found no actionable defects and independently passed core type checking and all targeted transcript tests. Shape review retained one traversal/scanning owner, with source and revision readers owning only their distinct identity/projection semantics. No new table, dependency, scheduler or storage format is introduced. Public routing integration remains the parent pass's responsibility.
