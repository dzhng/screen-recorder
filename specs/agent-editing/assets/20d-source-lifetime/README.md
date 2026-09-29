# Recording source-worker lifetime

A recording source generation may still be owned by a native child after its service dies. Local job recovery cannot prove that child has exited. Generation reclamation therefore requires an exclusive lease before removing either files or evidence rows; the source executor lends a shared generation lease to native work until it drains. Busy generations remain intact while unrelated abandoned generations are reclaimed.

Whole-recording deletion is a separate authority. Source work also lends a shared recording-root lease. Deletion reuses ManagedFiles.recordingDirectory to obtain exclusive recording admission before purging caches, evidence or media, then keeps that authority through completion, including inheritance by native removal children. Source-generation cleanup also borrows shared recording admission, so it cannot race an orphaned whole-recording remover. A busy recording returns actionable retryable failure; an already-removed root remains a valid restart state. A generation lock alone would not protect this broader removal path.

The inode-checked directory lease now has real acquisition, source-generation and recording-directory consumers in the existing file owner. It preserves canonical parent aliases, refuses a replacement leaf, follows the inherited open-file description and uses nonblocking platform locks. No lockfile registry, process supervisor or retry loop is introduced.

## Verification

The [retained evidence](verification.json) stops actual native source verification using the existing syscall barrier, kills its owner and starts a fresh public recording service. Startup preserves the held generation while reclaiming an unrelated abandoned generation. After the native child exits, explicit processing retry removes the old generation and publishes a new verified one. Independently, recording.delete refuses before source removal while the orphan survives, then completes after it exits.

Removing the generation descriptor reproduces premature startup reclamation. Removing the recording-root descriptor lets deletion incorrectly succeed while the native child is stopped. Dropping the native remover's inherited root descriptor independently reproduces premature release after its service dies. Restored code passes all three source/removal cases, the acquisition orphan controls and focused processing/deletion tests. Canonical and legacy recording package cases and public long-source cancel/drain remain green. Public fixtures now create private recording roots, matching the native admission contract already used by exports.

This establishes cleanup/deletion lifetime for these actual consumers, not a new source clock, capture layout or performance claim. Source verification budgets and the two unresolved bulk probe-metadata boundaries remain in their own [checkpoint](../20d-source-budget/README.md).
