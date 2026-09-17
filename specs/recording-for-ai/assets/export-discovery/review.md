# Export discovery evidence

- [Owner suite](owner-tests.txt): all 59 real native export cases pass, including
  bounded discovery, live arrivals, filter-bound cursors, abandoned IDs, queued
  work, failed retirement and committed private cleanup; bundled startup also runs.
- [Actual CLI/MCP restart](public-restart.txt): a complete package and a failed
  destination collision persist across a real service restart. CLI pages recover
  both IDs; MCP unfinished discovery finds the failed one. Status retains the
  original committed receipt, abandonment removes only the failed intent, and the
  produced ZIP still reopens after original library removal.
- [Initial red tracer](discovery-red.txt): discovery failed before implementation.
  The restored tracer and lifecycle tests are included in the final owner suite.

The shared registry also rejects oversized pages, wrong filter types and unknown
fields over the actual service boundary. Protocol tests pass 14 cases; service
unit/integration tests pass 99 cases. All eight build targets and workspace type
checks pass. Independent Codex review reports no actionable findings; its local
native test was blocked during fixture setup by sandbox restrictions, so the
unsandboxed receipts above remain the native verification authority.

The read-only owner and public registry are implemented. Native release still
requires an adapter that uses discovery after reopening the app; this test does
not claim that UI is shipped. Two partial indexes serve global/per-recording
unfinished scans. No additional persisted state, job admission or filesystem IO
is introduced by listing.
