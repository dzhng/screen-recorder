# Source processing integration review

Verified 2026-09-16 on the personal macOS development host.

- Core: 63 tests passed, including bounded ingestion, queue behavior, explicit retry,
  admission backlog, crash leftovers and published/live generation preservation.
- Service: 50 tests passed through actual Unix sockets and private control pipes.
- Protocol: 9 tests passed; CLI/MCP adapter suite: 7 tests passed.
- Build/typecheck: 8 dependency tasks passed; touched-source lint passed.
- Packaged native app: one own-window/no-audio test passed. It finalizes a take,
  polls readiness, pages raw cursor samples, rejects mismatched continuations and
  invalid ranges, cuts the recording without reprocessing source evidence, and
  relaunches into the same published page while reclaiming an abandoned derivative.
- The capture shutdown regression fails when its lifetime abort is removed, then
  passes restored. It also verifies shutdown waits for recovery worker settlement.

Independent Codex review first found unpublished crash leftovers. The fix adds
streamed cleanup that preserves published and active generations, including workers
still alive after cancellation. A second review reported no actionable regressions.
That reviewer ran type checks and 63 core tests; its service tests could not bind
Unix sockets in its sandbox. The separate root service run passed all 50 tests.

Shape review retained one core source processor, one queue and one native journal
parser. Cleanup belongs to the source processor and shares the catalog; it adds no
second job queue, timer or storage service. The pass adds public status/retry/raw
operations and an active-attempt query on the queue, with no new dependency.
Documentation links source-time evidence to the later edited projection owner.

This evidence does not establish transcript fidelity, scene boundaries, rendered
trails from real gestures, screenshots, audio audition, display/region capture,
full exports or the installed release workflow. Those gates remain open.
