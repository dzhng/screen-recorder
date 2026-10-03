# Reviewed implementation choices

- One retained recovery attempt lives in CaptureService. Existing serialization
  orders control transitions, while media work runs outside that queue. Status
  prefers the active attempt; startup drains each selected attempt before the next.
- The recording owns nullable bounded finalizationError. Missing report fields
  preserve it, an actual new attempt explicitly clears it, and terminal state wins.
  Catalog16 follows the already integrated indexed-assets15; incompatible libraries
  are refused rather than migrated or opened under a changed same-version layout.
- Recovery control exposes bounded track/lifecycle facts. Detailed support remains
  with native recovery models and existing source evidence, not a second diagnostic
  file protocol or a larger control-frame limit.
- Recovery has an operation-specific20-minute fragmentation allowance when canonical
  publication members exist, plus existing byte-work budgeting. This is conservative
  finite observation policy for the measured two-role work shape, not a universal
  runtime guarantee. Public requests acknowledge promptly; global deadlines are not
  widened. Work exhaustion retains bytes and a retryable failure.
- Native finalization diagnostics share one bounded domain translation. Proven
  invalid identity/proof/input remains distinct from operational filesystem access.
  Unknown operational publication failures remain retryable and independent roles
  continue. Corrupt media is not broadly reclassified as temporary IO.
- Capture cancel drains owned recovery but does not delete ambiguous bytes. Explicit
  library deletion retains that separate authority. Settled stop is idempotent;
  stopped cleanup repair and terminal explanatory-message disclosure remain parent
  obligations rather than implicit retries on ordinary reads.
