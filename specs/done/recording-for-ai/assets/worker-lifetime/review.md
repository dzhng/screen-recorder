# Native worker lifetime evidence

The media worker must stop when the process that spawned it dies. Before this change it
only ended when its blocking stdin read or its current operation finished, so a worker
decoding for a dead owner kept a core busy until it completed work nobody would read.

## Why end of input cannot carry the rule

The service media runner (`apps/service/src/worker.ts`) and the wire/frame fixtures
write one request and close stdin immediately. EOF therefore
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
  second `getppid()` reading in the registration handler checks the relationship after
  the kernel watch is installed, including reuse of the dead parent's process ID.
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
writer's temporary file in the caller's output directory. The registration handler checks the actual parent relationship; watching a reused PID
cannot keep an orphan alive. Durable job failure, retry and service-wide queue gates
remain separate work.

## Integration review

Independent Codex review found that `resume()` initiates registration asynchronously.
The initial immediate relationship recheck therefore ran too early. Integration moved
that check into `setRegistrationHandler`, matching the Dispatch SDK contract. The
integrated native build and all four real parent-death tests pass after this correction
(2026-09-15). These tests cover observed process behavior; forced PID reuse during
registration is not deterministically exercised.

## Service settlement and cancellation

The service media runner accepts an optional abort signal. An abort, deadline or
answer selects the result, terminates the child, and returns only after the child's
`close` event. A queue can therefore reuse capacity when the promise settles without
leaving the previous worker alive. Pre-canceled work never spawns. Parent death
remains independently enforced by the native executable.

Four real-subprocess regressions failed before this change: success and timeout
returned while the worker PID still existed, cancellation became a timeout, and
pre-canceled work tried to spawn. All four pass with the new lifecycle; the focused
worker plus capture service integration passes 21 tests. Service build, typecheck
and focused lint pass. Independent Codex review found no actionable defect and
ran the four worker tests; its wider socket tests were blocked by sandbox EPERM.

The tests use a worker that acknowledges its PID and deliberately stays alive after
answering. They verify the PID is absent at promise settlement, not after a grace
period. This does not add durable scheduling, retries or a client-facing operation;
the later queue must pass its cancellation signal to this existing runner.
