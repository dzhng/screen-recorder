# Public deletion integration

The service's deletion coordinator commits catalog intent before awaiting any
producer. Intent hides the recording and rejects new work; existing byte leases
are revoked immediately. Queue and capture owners both finish shutdown before
native file removal. Cleanup failures retain identity and return a retryable
failure. Repeated deletion joins the current attempt or resumes retained intent.

Native removal uses pinned directory descriptors; the [filesystem evidence](managed-files.md)
covers actual ancestor swaps and external sentinels. Core owns the file identities
and metadata. Cache rows remain until native removal succeeds, while retained-index
cleanup after directory removal is SQL-only. Ordinary cache eviction is unchanged.

## Verified on the merged tree

- Seven service coordinator checks cover coalescing, immediate lease revocation,
  a held worker after abort, capture refusal while that worker closes, startup
  cleanup drainage, service close during native removal, per-record restart
  isolation, and reopening after a catalog fault following file removal. These tests model native
  receipts; they do not replace the following native checks.
- The built app's public deletion test records only its own fixture window, with
  both audio roles disabled. CLI measures and deletes an active take; a replacement starts and
  MCP measures and deletes it. Both adapters then return `NOT_FOUND` for that take’s
  storage usage on the same scratch service. Actual allocated directories disappear, old catalog reads fail,
  and repeated deletion succeeds. This proves the native capture path, not audio
  fidelity or external-agent understanding.
- The built app's restart test seeds durable intent and generated leftover source,
  cache and retained-index files before startup. Startup removes them and their
  metadata without a delete request; sibling source/cache, shared models, external
  link targets and an unknown-ID directory survive byte-for-byte. Repeating delete
  across a second launch succeeds. Disabling startup resume makes the test fail.
  This is a seeded crash state, not a process killed halfway through native unlink.
- The merged core suite passes 245 tests and workspace type checks pass. The final
  concurrent-LRU addition then passes all 13 focused storage tests; it adds no
  production behavior. Eight
  native filesystem checks pass. Capture regression ran 13 checks: 12 passed and
  the controller fixture initially linked an obsolete Swift object. Selecting
  objects from SwiftPM's current output map makes that final check pass without
  changing product capture code.
- Independent review found no actionable regression. Its broader service tests
  could not bind Unix sockets inside its sandbox; the merged host run passed all 76 service
  tests after storage integration.

[The merged storage receipts](usage-merged.json) preserve actual service/CLI/MCP
parity and independent inventory totals. The 2,500-file run observed about 534 ms
scan time and 3.82 ms worst health-plus-sibling-read pair. These are host observations,
not throughput promises. [Storage semantics](usage.md) explain live-scan omissions
and the distinction between recording bytes and shared database overhead.

[Worker-process drainage](worker-deletion.md) passes an actual stopped native
worker and a mutation that removes queue drainage. The [explicit frame/audio/index lease matrix](delivery-deletion.json) also passes:
all three target tokens expire before their advertised deadlines, reacquisition
returns `NOT_FOUND`, and sibling token bytes, source hashes and usage remain unchanged.
Misattributing any one producer reproduces a failure. Physical audio, real cursor gestures, edited video and full installed
agent workflows remain open parent gates.
