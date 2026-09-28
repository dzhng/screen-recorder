# Concurrent render attempt ownership

A live render holds a shared lock on the service's existing private workspace and
an exclusive lock on its own child attempt. Native children inherit both. Independent
frame/audio jobs can coexist; finishing or canceling one reclaims only its child.
Startup and deletion require exclusive root authority, so an orphaned native child
still prevents destructive whole-root recovery.

Cleanup uses retained directory descriptors and exact entry identities, including
removing the empty child. Re-resolving an attempt's pathname after its parent was
renamed would target a replacement directory. The existing native cleanup owner
therefore removes relative to the retained parent, sharing the checked removal
primitive with package workspaces. Completed audio/image copies use one helper;
recording movies retain their existing rendering API.

[Render/worker tests](./tests.txt) passed all 27 checks with the freshly built native
worker. They cover overlapping attempts, cancellation while another worker remains
live, exclusive startup refusal, orphan lock inheritance, exclusive output retention,
receipt substitution, actual native cleanup descriptor order and replacement-path
safety. Focused types and lint checks passed.

[The actual movie lifetime gate](./movie-lifetime.txt) proves independent render
success leaves stopped orphan staging byte-identical for both rendering and
preparation. Startup remains blocked until the worker dies, then recovery and reuse
succeed. Assembly abort/deadline, audio/movie finalization and renamed-parent sentinel
checks remain green. The harness observes staged files without retired private
staging prefixes, and uses canonical native paths for process identity.

[Wire conformance](./native-wire.txt) and [package workspace preservation](./package-preservation.txt)
retain the existing removal owner's behavior. [Runtime hashes](./runtime.json) distinguish
the rebuilt worker from the unchanged auxiliary finalization fixture. No new native
opcode, worker pool, temporary store, capture, app or installed-library mutation was added.

The [initial concurrency failure](./concurrency-red.txt) and [path-authority failure](./path-authority-red.txt)
record the defects. Removing the inherited root lock [fails orphan protection](./root-lock-mutation.txt);
reversing descriptors [fails actual native cleanup](./descriptor-order-mutation.txt).
All mutations were restored before the final passing gates. Public source/project/frame
routing uses this owner only after the parent's coordinated caller integration.
