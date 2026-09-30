# Revised room-tone packet choices

The requested source, overlap duration, spacing, sine/cosine key count, outer
fades and diagnostic gain are explicit parent instructions, not new discretion.
The following implementation choices remain for root to bank in the shared ledger.

## Sound — high confidence

**Content-clock keys, one source occurrence per track.**

- When: revised room-tone overlap packet.
- Choice: Each repeated region starts at source time zero on its own audio track.
  A content-anchored gain window means the curve follows that region's local source
  samples. For example, while one region plays its last200ms, the next plays its
  first200ms; both contribute through the existing public mixer. The keys are
  read back from public processing state before the independent sample calculation.
- Gap: The request fixed the fade shape but did not prescribe track layout or key
  anchoring. Alternating a smaller set of tracks would also represent this fixed
  loop, but would add placement/track-assignment logic to a single finite packet.
- Reach: This declares only the review project's layout. It adds no product
  ambience helper, automatic region choice or default processing policy.
- Verdict: sound. Explicit public occurrences and content windows make the two
  simultaneously playing source positions unambiguous without another renderer.
- Confidence: high.

**Keep complete transient deliveries in the exchanges instead of duplicate WAVs.**

- When: revised room-tone overlap packet.
- Choice: The scratch run writes and checks the actual dry-source and undo WAVs.
  The durable packet retains the original source in its existing home and one
  normal loop. The dry source is byte-identical to that original; undo is
  byte-identical to the normal loop. Their complete MCP audio bodies, public
  receipts and hashes remain in the compressed exchange record. A reviewer can
  reconstruct either transient delivery without a second copy of those samples.
- Gap: Actual undo delivery was required, but redundant permanent audio files
  were not. Retaining all four WAVs would duplicate bytes already preserved.
- Reach: The report's delivery entries describe actual runtime deliveries,
  including transient ones; they are not a permanent filename inventory.
- Verdict: sound. Complete transport evidence preserves the equality proof and
  avoids unnecessary repeated audio assets.
- Confidence: high.
