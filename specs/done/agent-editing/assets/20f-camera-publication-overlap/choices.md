# Choices reviewed for this pass

All entries are sound; no user-only decision or unsound retained choice remains.

- **Single occupied segment qualification — high confidence.** A closed camera
  file with exact mapping and one complete native sample inventory can schedule
  a private export before decoding. Several occupied segments use the generic
  path: joining them would require a new support interpretation. The plan left
  supported qualification shape to this pass; this conservative boundary avoids
  inventing acceptance and can later be widened with physical proof.
- **Share the timing walk — high confidence.** MediaProbe already walks native
  samples in presentation order. Camera scheduling consumes that walk through
  SampleTiming instead of introducing a second cursor interpreter. Both consumers
  keep their distinct outputs while agreeing on clipping and progress.
- **Deferred scan results — high confidence.** If raw validation refuses, a
  speculative export/canonical error must not replace it. Both scans settle, then
  the production arbitration owner chooses raw first. If raw yields only a prefix,
  it ignores speculation and reuses the existing export/verifier. Synthetic
  combinations test this decision only; they do not assert native interruption.
- **Observation-only cancellation control — high confidence.** The tiny fixture
  signals cancellation when both actual readers report reading. Test-process SDK
  observation delegates the original implementation, changes no samples, restores
  it after joining, and proves no reader/publication remains. A fake scanner or
  blocking barrier would not establish the production lifetime.
- **Stop the corruption experiment — high confidence.** Damaged sample bytes
  left the native inventory intact but decoding still completed. Another payload
  search would add experiment cost without a deterministic failure contract.
  Preserve that outcome and withhold the qualified-interruption/performance claim.
