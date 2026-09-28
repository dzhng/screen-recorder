# Preserve failed-startup diagnostics

The independent review's cleanup EPIPE exposed a shared harness issue. A bounded
probe with a regular file as the scratch service home reproduced it outside the
review environment: startup reported ENOTDIR, then the cleanup IPC send replaced
that error with EPIPE. The original review's underlying startup cause is still
unknown; this controlled probe does not establish it.

JourneyService now tracks whether startup completed and judges shutdown through
its existing bounded terminal-exit check. Sending the close request has a callback
so an IPC disconnection during failed startup cannot replace the primary error.
A successfully started service must still exit cleanly; forced shutdown retains
its signal assertion. The shutdown deadline is unchanged.

The [focused public-service regression](../../../../../packages/test-harness/editing/source-service-lifecycle.mjs)
first failed because cleanup replaced ENOTDIR with EPIPE. With the helper fix it
preserves ENOTDIR, waits for the failed child, and passes normal stop, forced stop,
idempotent repeated stop and restart with real CLI/MCP service requests. The
[before probe](cleanup-before.log) and [successful run](cleanup-after.log) are
retained. A first healthy-control home was too long for the macOS Unix socket;
shortening that test directory name corrected the fixture, not the service.

No editor, renderer, queue policy or production shutdown behavior changed.

Independent Codex review found no actionable regression. Its failed-startup
assertion passed; the healthy-service check was blocked by `listen EPERM` in the
review sandbox. That error now reached the caller intact rather than being
replaced by cleanup EPIPE. The author's unrestricted run completed all checks,
including actual CLI and MCP project-list requests. This review does not establish
the underlying cause of the earlier, masked lifecycle-review startup failure.

Root integration also passes the complete failure/graceful/crash/restart probe
on the combined checkout; `cleanup-root.log` retains its terminal result.
