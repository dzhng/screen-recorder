# Archive extraction proof

This is the internal [14c1](https://github.com/dzhng/screen-recorder/blob/2e1028cddc3f89d58018a4ebcbc8895b28a78ae1/specs/recording-for-ai/slices/14c1-bounded-archive-extraction.md) boundary:
real system libarchive, native descriptor-relative writes and the existing worker,
manifest and history owners. Generated payloads stand in for media/evidence bytes;
this is not relocated playback, accepted transcription or a public package handle.

## Result

The [machine receipt](archive-extraction.json) records the tested native hash and
bounded metrics. All 38 generated archive checks and eight existing ManagedFiles
checks pass. Core's 267 tests and service's 85 tests pass; type checks and focused
lint pass. The service suite ran with one test worker after an initial broad run
hit missing local build outputs and a fixture's startup deadline under contention.
No product deadline or assertion was relaxed.

The archive suite proves complete traversal after the manifest, malformed central
and local tails, underreported entry counts, macOS metadata visibility, CRC and
inventory SHA errors, special/encrypted entries, effective-name aliases and exact
resource limits. A safe Unicode override maps to its ASCII inventory member; NUL
and Unicode duplicates/traversal cannot hide extra content. Pinned old revision
selection retains later admitted history without adding fake catalog rows.

At the default 8 MiB initial parser-input cap, a 150,000-entry fixture fails before
returning its first header. Peak native RSS was about 32 MiB; an oversized metadata
entry and smaller-budget many-entry fixture stayed about 11 MiB. This measures the
real parser's eager central-directory allocation on the recorded runtime, not just
bytes observed by the caller. Tests retain a generous 192 MiB upper guard to detect
unbounded growth, without treating minor host variation as product performance.

A confirmed live native process is stopped at a file barrier, then canceled; the
worker waits for its disappearance before cleanup inherits the parent's FD. A
separate controlled inner-directory swap replaces `source` with an external
symlink. Native traversal fails and the external sentinel remains alone. Replacing
the workspace pathname or already-open input pathname does not redirect reads or
writes. The descriptor's advisory lock also survives child exit and rejects a
second open owner. Filesystem write-limit termination cleans up; detected workspace
ownership loss returns an explicit cleanup error, and the retained FD permits a
subsequent recovery cleanup. Parent crash/startup reclamation remains later work.

Two deliberate production mutations went red, then were restored and rebuilt:

- Ending traversal after the manifest made the malformed-local-tail test fail
  with “Missing expected rejection.”
- Removing directory no-follow allowed `capture.journal.jsonl` to appear beside
  the external sentinel. The containment assertion failed on the extra file.

All owned processes from these runs were reaped. Original ZIP bytes were hashed
before/after each unmodified-input case; the controlled source replacement restores
and checks its retained original. The optional harness is
`bun run --cwd packages/test-harness lab:package-archive`; it is not added to default
native capture tests and requires the documented native/core/service builds.

## Review boundary

Independent Codex review completed with no actionable findings within the stated
threat model and receipt-only scope. Shape review kept one process owner and one
cleanup traversal; untouched Swift formatting was restored before review.

Shared cleanup remains one descriptor traversal implementation. Lock admission is
independent of ZIP, and worker FD inheritance preserves the existing process owner.
The only third-party additions are two licensed upstream public headers; the OS
provides the runtime. Numeric defaults remain in the core owner, not copied into a
new scheduler or persistent counter. No package context, import, public route or
read-time containment claim is introduced by this checkpoint.

## Merged verification

Main builds against the system library and passes all [38 archive cases](archive-merged-tests.txt),
[eight existing native cleanup cases](archive-merged-managed.txt), and
[20 service worker/render/deletion checks](archive-merged-service.txt), plus service
types. These checks include the merged pointer/preview and capture-clock work.
Retained package contexts are the next14c boundary; no public open handle is claimed.
