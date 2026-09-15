# Native worker lifetime evidence

The media worker must stop when the process that spawned it dies. Before this change it
only ended when its blocking stdin read or its current operation finished, so a worker
decoding for a dead owner kept a core busy until it completed work nobody would read.

## Why end of input cannot carry the rule

Every runner in the repository — the wire and frame tests, the cursor lab, the bootstrap
conformance harness — writes one request and closes stdin immediately. EOF therefore
arrives while the owner is healthy and says nothing about whether it is still there. The
fixtures below hold the worker's stdin open from the outer test process, so parent death
is the only variable: a FIFO opened read-write by the test survives the owner it was
handed to.

## Measured Darwin behavior

Probes in `/tmp/screenrec-worker-lifetime-evidence` (scratch, not retained) established,
rather than assumed:

- A Dispatch process source with `.exit` on the parent fires when that parent is
  `SIGKILL`ed, and `getppid()` reads 1 from the same moment: an orphan is reparented to
  launchd before its parent is reaped.
- The same source also fired when registered against an already-exited pid, both zombie
  and reaped. That is undocumented, so the implementation does not depend on it; the
  second `getppid()` reading after registration is what closes the startup race, and it is
  also the only check that survives reuse of the dead parent's process ID.
- A shell sends a background job's stdin to `/dev/null`. An earlier orphan fixture was
  invalid for that reason — the worker ended for want of input, not for want of an owner —
  so the retained fixture hands the request pipe on explicitly.

## Red and green

`node --test helpers/mac/Tests/lifetime.test.mjs` against the baseline worker
(3e7fe52) fails all four cases, each because the worker outlived its owner:
[red.txt](red.txt). The same file passes against the change in about 2.2 seconds:
[green.txt](green.txt).

The cases are: an owner killed after the worker has actually answered a ping; an owner
that exits immediately after spawning; a worker whose first instruction already runs
under launchd, which answers nothing at all; and an owner killed while the worker is
inside a long `media.frame` decode, checked to be still unanswered at the moment of the
kill rather than assumed from a sleep. The last one also re-reads the source digest and
the caller's output path afterwards: the source is unchanged and no partial frame is left,
because frames are written atomically and sources are never opened for writing.

The full worker gate is green: `swift run --package-path helpers/mac
ScreenRecorderCaptureTests`, `ScreenRecorderFrameTests`, `ScreenRecorderAudioTests`,
`swift build --package-path helpers/mac`, then `node --test helpers/mac/Tests/*.test.mjs`
(14 tests).

## Decisions the contract did not state

- Abandoned work exits 75 and writes one stderr line naming the parent it was watching.
  The wire contract only governs stdout, and the exit status of an orphan is normally lost
  to launchd; the diagnostic is what let the tests confirm *why* a worker ended.
- A worker whose parent is already launchd at startup refuses the work waiting on its
  stdin. This executable is only ever spawned by the service, so no owner means no work,
  and it is the same condition as losing the parent one instruction later.
- No service adapter argument changed. The spawning process is the owner, so the parent
  relationship already carries the identity; nothing needed to be passed or registered.

## Limits

This binds a worker to its spawning parent only. It is not cancellation, it says nothing
about a worker that is itself killed, and an interrupted atomic write can still leave the
writer's temporary file in the caller's output directory. Pid reuse between the parent's
exit and the first reading remains a theoretical window that the post-registration reading
closes but does not eliminate. Durable job failure, retry and the service-wide queue gates
are untouched.
