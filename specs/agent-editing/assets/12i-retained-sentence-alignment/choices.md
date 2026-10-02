# Case choices

## Sound — high confidence

**Use one synchronous subprocess owner for both children.** Conversion and
alignment need the same technical facts: actual PID, terminal exit, deadline and
kernel peak memory. One standard `wait4` owner records those facts for each child
without introducing a second transport or restarting when observation pauses.
The plan required lifecycle/resource evidence but left the process-observation
mechanism open. This is case evidence code, not a production process API.

**Make the maintained saved verifier read-only.** An evidence check that rewrites
the original report can erase the distinction between the failed producer and
later numerical qualification. The current verifier prints its complete result
and never changes a retained artifact. Its own source and the first executed
verifier snapshot are pinned separately. The task required that distinction but
left the verifier interface open. This choice lets root repeat cheap saved-data
checks without touching the one-shot model case.
