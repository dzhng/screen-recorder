# Held-frame thumbnail reuse

Commit `babc2f7` retains one pixel buffer and its small rendered thumbnail. Buffer
identity cannot be recycled while retained; an empty interval clears the cache.
Rows still report each requested interval and consume the same output budget.

The isolated full video-render suite passed 17 tests. Its original 30-second
worker limit and 24 MiB memory-growth limit were unchanged. A deliberately stale
cache mutation failed the strengthened distinct-frame assertion; restored code
passed the four presentation checks. Logs and timing reports are adjacent.

Independent Codex review found no actionable regression. Its sandboxed build/test
attempt did not complete; those checks are supported by the isolated implementation
run, not the independent review. Main-worktree integration passed five presentation/color checks; the memory
test took 3.638 seconds, retaining the original timeout and memory limits. Shape review accepts one bounded cache rather than an unbounded
frame map; the native README documents the invariant.
