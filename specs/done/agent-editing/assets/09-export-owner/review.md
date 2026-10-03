# Export owner verification

The project checks are **project export owner tests with native publication**.
Their renderer writes inspectable JSON plan bytes behind a movie receipt. They do
not establish native composition rendering, decoded MP4 correctness, or public
project CLI/MCP acceptance. That separate journey remains open in slice 09.

[The final owner run](project-export-owner.txt) passed ten tests using real project,
asset, job, cache and publication owners in isolated temporary libraries. Native
publication is real; only renderer output and worker response timing are controlled.
The suite covers historical pinning/replay, retained bytes, eviction/regeneration,
cache leases, cold recovery, cancellation/retirement, and narrowly scoped explicit
retry. [Core tests](core-tests.txt) passed sixteen focused preview/project/cache
checks. Core build/typecheck and scoped exporter/deletion TypeScript compilation
also passed. Full service typing awaits the root-owned class/cursor integration;
this pass does not claim a whole-service typecheck.

[Recording preservation](recording-preservation-initial.txt) initially passed 61 of 63
cases. The recovery-backlog failure observed ENOENT while the shared native binary
was rebuilt; the bundled-startup case reached its existing deadline while the
scratch app contained an incomplete service build. After pinning an immutable
native executable and rebuilding only the scratch bundle, [both controlled reruns
passed](recording-preservation-recheck.txt) within unchanged deadlines. This is
coverage of all 63 cases across runs, not a single green full-suite run. The
[initial build](build-initial.txt) and [successful scratch rebuild](bundle-recheck.txt)
are retained separately. No installed app, user library, desktop focus or playback
was used.

The [actual package relocation consumer](package-relocation.txt) also passed: its
native ZIP publication and relocated public CLI/MCP inspection preserve existing
recording/package behavior. It does not substitute for project movie acceptance.

Regression falsification established the failures before accepting the fixes:

- [Dropping the pinned revision/build](pin-regression-red.txt) published the wrong plan.
- [Admission-time implementation absence](implementation-admission-red.txt) was
  terminal even after the original renderer returned.
- [Queued execution-time absence](implementation-execution-red.txt) left its
  prerequisite terminal instead of recoverable through explicit retry.
- [A stale export error](stale-retry-red.txt) wrongly retried a newer decode failure
  and committed; the final owner run now leaves that dependency failed.

Shape review retained one intent table, queue, derived cache and publication owner;
optional domain bindings avoid fake legacy stores. No compatibility class or
parallel project exporter remains. The cohesive publication lifecycle stays in the
existing exporter rather than being split into competing owners. Catalog format 4
refuses earlier unshipped schemas; migration is deliberately outside this pass.

Independent read-only Codex reviews found a missed package-test consumer, the
queued-implementation recovery gap, and the stale-error retry gap. Each was
reproduced and fixed; no finding was dismissed. The first review's sandbox native
fixture failures and interrupted broad test were not used as validation; direct
controlled runs above provide that evidence. Later reviews inspected code and
pure tests only. Root's final bounded read-only check found no remaining issue in the retry correction and its three regressions; it inspected source/tests without rerunning them.

Documentation links follow the spec slice into this evidence and actual owners.
Root owns public protocol/routes, the required neutral cursor shape, and the live
native project-export journey; those integration results must be recorded separately.
