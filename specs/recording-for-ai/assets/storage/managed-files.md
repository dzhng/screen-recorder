# Descriptor-relative managed-file removal

The native filesystem boundary removes a recording tree or a bounded cache batch
only beneath opened directory descriptors. The service supplies catalog-owned
identities; native code owns filesystem traversal, not catalog selection or cleanup.
The [implementation](../../../../helpers/mac/Sources/ScreenRecorderWire/ManagedFiles.swift)
uses Darwin `openat`, `fdopendir`, `fstatat`, and `unlinkat`. It does not reconstruct
absolute paths from descriptors or call a pathname-based recursive remover.

Home and cache identities arrive as decimal strings and compare as unsigned 64-bit
integers. Opening the canonical home rejects symlinks in all path components;
subsequent fixed ancestry and recursive descent reject directory symlinks. A link
inside the owned recording is itself removed without opening its target. Missing
recordings and cache leaves make retries succeed. Other I/O failures retain a
structured error; callers must retain deletion intent and catalog ownership until
native removal succeeds. The native worker's existing process lifetime governs
cancellation and deadlines.

## Verification

Run `swift build --package-path helpers/mac --product screenrec-native`, then
`node --test helpers/mac/Tests/managed-files.test.mjs helpers/mac/Tests/wire.test.mjs`.
The managed-files tests use real scratch files and the ordinary native wire route.
They cover sibling/model preservation, ancestor/root symlinks, descendant link
removal, stale identities, invalid/unbounded requests, retry, and a 2,048-file tree.
The recursion guard refuses directories beyond 64 levels. Forty repetitions of
success, excessive-depth failure, and home-identity failure in one native process
leave exactly the same open-descriptor set measured with `lsof`.

The test-only syscall interposer swaps a real ancestor to an external symlink
immediately after `openat` returns. Both recording and cache operations remove the
pinned owned content while preserving an external same-name sentinel. Replacing
the production removal calls with pathname removal made both tests fail with the
external sentinel missing; restoring descriptor-relative removal returned green.
The same interposer supplies an inode above JavaScript's exact-integer range: an
exact decimal identity succeeds and its adjacent rounded value fails.

These receipts prove the native primitive. Service deletion must use it before
metadata-only reclamation. They do not certify ordinary cache eviction or retained
index cleanup paths that still perform pathname unlinking, or the complete public
recording-deletion journey.
