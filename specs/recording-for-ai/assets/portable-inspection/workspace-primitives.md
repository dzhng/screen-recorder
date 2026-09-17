# Admitted input and workspace lifetime verification

[Machine receipt](workspace-primitives.json) records the combined native binary and
production source hashes, retained-inspection parity and bounded lifecycle results.
The generated fixtures contain no user recordings, capture-device access or ASR.

The merged worktree passed 40 actual native archive tests and eight workspace
lifecycle tests (8.03 seconds together), plus the retained ZIP matrix (18.36 seconds).
Input path replacement preserves the admitted original object; changed input fails
before copying, and an in-place change at a confirmed stopped-worker barrier fails
during copying. The fixture interposes the first FD4 positioned read, confirms
SIGSTOP and an empty snapshot, then resumes/drains the worker after mutation.
The initial file-observation timing probe raced after copy completion; those were
harness synchronization failures, not native validation failures. Independent same-input opens use separate snapshots; closing one
leaves the other readable and able to generate a frame. Copied size equals actual
input bytes. All generated inputs and external sentinels remain unchanged.

A real permission failure during full close keeps output charge and refuses new
reads/work. Restoring permissions allows an explicit close retry to empty the
workspace and return credit without readmission. Concurrent closes share an attempt.
Parent-relative workspace operations survive ancestor replacement, reject replaced
children, and preserve the exact recovery identity when admission cleanup fails.
An inherited child descriptor keeps removal busy until the child is reaped; the
existing killed-parent/stopped-native-child matrix also stays green. Root review
identified a lost-rmdir-reply retry gap: its actual native regression failed with
ENOENT before the fix. Absent-child retirement now succeeds beneath the retained
private parent, while existing replacement directories and symlinks still fail.

Deliberate mutations prove the guards: caching rejected full close causes the retry
to fail; using shared-offset reads breaks the second copy; removing the after-copy
stamp reaches the wrong error at the deterministic syscall barrier; removing the independently
acquired workspace lock lets removal incorrectly succeed while the inherited child
lives. All mutations were restored before the combined native runs. No owned jobs
remain live.

306 core and 97 service tests, service/native builds and scoped lint pass. The first
uncapped core run competed with native builds and hit three unchanged five-second
test deadlines; the capped four-worker suite passed all tests without product or
assertion changes. Independent review found no actionable regressions in the input
and cleanup changes; the workspace owner had its own independent clean review.
Those reviews did not supply the native proof above: this worktree's explicitly
selected combined executable did.

The registry, pool reservation/recovery policy and public package selectors remain
unimplemented. This evidence proves the owner primitives and current retained
inspection, not a user-visible package-open operation.
