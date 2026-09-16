# Source timing integration

Verified 2026-09-16. The source processor calls the native source-evidence exporter
and publishes cursor, geometry, completed pauses and acquired audio together.
Core indexes native-normalized data; it never opens the original journal itself.

- All 82 core tests passed, including receipt-count validation, per-role disjoint
  acquisition intervals, clipped range reads, pause boundary inclusion, rejected
  malformed timing, stable raw cursor pagination and orphan cleanup.
- All 56 service tests, nine CLI tests and nine protocol tests passed.
- Eight app/service/CLI build and typecheck tasks passed.
- Four packaged-app tests passed together: source processing/relaunch, generated
  timing publication and indexed reads, own-window CLI/MCP frames, and generated
  sparse/full-resolution frame inspection with actual LRU eviction/restart.
- Native source export: ten tests passed on the root checkout after rebuilding the
  debug worker. The initial manual run used a stale debug binary and returned
  UNKNOWN_OPERATION for every test; rebuilding the named product resolved that
  test setup failure. The packaged release binary passed integration independently.
- Root measured 100,000 audio gaps at 23,494,656 bytes peak worker RSS. Capture and
  recovery executable tests passed after the shared streaming-reader change.

Independent review ran type checks and 82 core tests and reported no actionable
regressions; its full socket suite was sandbox-blocked. Root performed the actual
socket and packaged-app runs above. The native review's two integration findings
(old service operation and missing TypeScript timing cases) are both resolved.

Shape review uses one native parser/merge owner, one core source index and one
published generation. Range reads use bounded indexed queries; audio needs only
one preceding disjoint interval plus intervals starting inside the requested range.
The original source remains immutable. Cursor-only development catalogs are
explicitly refused under the existing fresh-format policy, without deleting them.

This pass establishes timing evidence, not audible excerpt quality, default trail
reset behavior, transcript fidelity or a complete agent edit/export workflow.
