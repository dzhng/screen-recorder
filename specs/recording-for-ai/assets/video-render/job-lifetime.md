# Pinned render jobs and terminal attempt cleanup

The integrated `bun run lab:render-timing` entrypoint exercises actual core
revisions and render plans through the durable heavy-job queue, the service's
existing media process owner and the native renderer. Its
[receipt](job-lifetime/report.json) and short generated movies are retained here.
No public preview route or alternate process owner is introduced.

An admitted job pins a cut revision before execution. Undo then changes the current
revision. The admitted job still yields source frames 0, 1, 3 and 5 at playback
0, 1, 2 and 3 seconds; a later job follows undo and yields all six original frames.
Independent decoding measures exactly four and six seconds. A sixty-second pause
remains a timeline marker at edited time two seconds; that wall time never extends
the movie. The source hash is unchanged. This is a generated source-clock/pause
projection proof, not a replacement for the actual capture workflow evidence.

## Ownership follows worker termination

`withRenderedVideo` owns a private attempt directory beneath the parent supplied by
the caller. Native output and its private encoding stage remain inside that scope.
The consumer must finish retaining or inspecting successful output before returning;
`try/finally` then reclaims the scope. Parent 13's artifact owner can use the same
lifetime to ingest a completed movie. Returning a temporary filename for later use
would violate this contract.

The media worker promise settles only after the child and pipes actually close.
This lets the adapter reclaim all native partial files without guessing native
staging names. Abort is checked before work, after the native reply and after
consumption. Queue publication still belongs to the existing attempt/generation
checks. Cancellation after consumption does not roll back consumer side effects:
the durable commit owner must fence publication or reconcile an already committed
result. A regression explicitly preserves a consumer-owned file after cancellation;
only the private attempt is reclaimed. Parent 13 and public export retain ownership
of their eventual commit points. The native reader also checks cooperative task cancellation inside the
loop that consumes discarded source frames.

The real native lab observes staging while work is active, then exercises queue
cancellation, direct abort and a deliberately short deadline. Every case leaves
zero attempt directories and no consumed result. It separately aborts after native
success but before the adapter receives that success; consumption remains fenced.
Service tests hold a real child process to prove its partial files still exist
after actual child close and disappear only when the adapter finishes cleanup.
They also cover consumer failure and abort during consumption.

## A render-specific bounded deadline

Unrelated media calls retain their default short deadline. A render budgets the
last source position at realtime speed plus thirty seconds for setup. This includes
discarded prefixes because the renderer reads sequentially; using edited duration
would underbudget a short excerpt near the end of a long source. The budget is
clamped to the platform timer range. Invalid per-call deadlines fail before spawn.
This is a conservative safety limit, not a speed claim or a promise to retry.

## Remaining boundaries

Service death can prevent any JavaScript `finally` from running. The future durable
artifact/job integration must supply an owned attempt parent and reclaim abandoned
parents after restart has made their jobs terminal. This pass proves cancellation
and timeout while the service owns the attempt; it does not add a scanner or claim
restart cleanup for a public preview job that does not yet exist. Audio, pointer
composition, public preview/export and the installed editing journey remain parent
13 work. The renderer's even-dimension limit matches app-originated captures:
`NativeCapture` caps the long edge at 4096 and makes both dimensions even; external
media import is outside this release.

The service build/typecheck, focused worker/attempt tests and repeated native lab
runs pass. Independent read-only review found no actionable ownership, cleanup,
abort or deadline defects. Reproduction requires the ordinary protocol/core/service
and native builds; `SCREENREC_NATIVE` may select a bundled executable instead of the
worktree's debug worker. No root build artifacts are required or modified.

Merged verification passed the twelve focused service worker/attempt tests and
the integrated native lab after rebuilding the service and debug native worker.
The lab independently decoded the expected four- and six-second pinned outputs,
and all four interruption cases left zero attempt directories.
