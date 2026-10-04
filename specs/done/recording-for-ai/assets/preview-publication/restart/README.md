# Render workspace ownership across service death

A private render workspace has one owner at a time. `withRenderedMedia` opens its
dedicated 0700 directory with Darwin's nonblocking exclusive directory lock and
passes that open descriptor through the existing media worker. The lock belongs
to the shared open-file description, so killing Node does not release it while a
native child still owns its inherited copy. A competing admission returns a
retryable `RENDER_WORKSPACE_BUSY` immediately; it does not poll or delete staging.

Once admission owns the lock, native cleanup checks the directory identity and
private ownership, then uses the shared descriptor-relative ManagedFiles traversal.
It clears the dedicated workspace before starting new work and after the actual
worker and consumer finish. A failed initial cleanup refuses admission without an
internal retry. Cleanup has the existing bounded worker deadline, ignores the
render's already-aborted signal, and releases its descriptor only after that
cleanup worker is terminal. The root directory itself remains caller-owned.

This extends the existing attempt owner. There are no PID files, lock files,
restart scanner, scheduler or extra subprocess implementation.
The same locked helper backs `clearRenderWorkspace` for service startup/deletion
admission before jobs may start. An absent workspace requires no creation or native
spawn. A live orphan blocks both this barrier and render admission. All contents of this dedicated workspace are disposable
staging, never source media, retained cache content or consumer-owned publication.

## Preparation stays inside that lifetime

Optional pointer preparation receives the attempt directory, the bound worker and
the render signal. Every preparation worker inherits the workspace descriptor as
child FD3; any additional descriptors follow it. Preparation must await all its
work before returning the core schedule receipt. Its caller supplies an appropriate
existing per-call deadline for long presentation-evidence scans. The movie request
then receives that receipt, keeping evidence, schedule and render in one attempt.
This is an internal seam, not a new public preview route.

## Boundary of filesystem ownership

The service must keep the workspace and its ancestry stable and exclusively owned
while AVFoundation writes through paths. A directory lock is not protection against
arbitrary same-user renames, nor a claim that AVAssetWriter is descriptor-relative.
Cleanup is independently anchored to the verified descriptor: if the path is
replaced after rendering, it empties the original workspace and leaves the
replacement and external symlink targets untouched. Linked/non-private workspace
roots are refused before cleanup.

[Verification receipt](verification.json) pins the combined binary and adapter.
[Native lifecycle output](native-lifetime.txt) and [pinned job report](pinned-jobs.json)
retain the observations; [service checks](service-tests.txt) cover the admission seams.

## Proof

The existing native movie lifetime harness now starts a separate Node owner through
`withRenderedMedia`, observes its actual native child, stops that child, and kills
Node. The replacement admission fails busy while the stopped child retains the
lock. After killing that child and observing its exit, reuse removes abandoned
staging and produces a valid movie. Both rendering and native presentation
preparation take this path. Test process IDs identify owned processes for signals;
they are never ownership metadata in the product.

The same harness retains normal abort, deadline, failure and SDK finalization
checks. A descendant symlink and an ancestor replacement preserve an external
sentinel. Service tests cover busy admission, failed-cleanup forward progress,
invalid workspace roots, late cancellation and consumer-owned effects. Removing
only descriptor inheritance makes the orphan test fail because a competing render
incorrectly consumes the busy workspace; restoring it returns green.

The native pointer-aware request is integrated with 13d4. The pinned JobQueue/cache
lab now runs actual native presentation evidence, core schedule writing, and movie
consumption inside the same attempt. A deliberately corrupted schedule receipt is
rejected, proving the returned receipt is forwarded rather than ignored. This
fixture has no cursor observations; visible glyph correctness remains the separate
13d4 proof. Existing cut/undo/audio/pause assertions remain. Cancellation waits for
`jobs.idle()` before a direct next render: directory emptiness alone is not proof
that the prior worker and workspace lock have been released.

Independent review first caught the missing native pointer-consumer dependency;
it is resolved by integration and the real successful/invalid-receipt tests. The
private locked helper additionally supplies the actual service startup barrier;
root wiring owns the public service restart/deletion gate. These proofs exercise
the real Node render owner and native worker, not an advertised public preview
route. Physical-device capture and audio audition are not claims of this pass.
