# 03 — Owned CLI execution

Status: implemented; focused source and immutable-tool proof complete. Packaged release integration remains a release gate. Question: **Can a raw FFmpeg task finish, fail and retire within the existing worker lifetime?**

Dependencies: [01](01-lgpl-build.md).

## Contract and owner

Service worker.ts owns process lifetime; protocol-specific decoding sits at its boundary.

Generalize existing lifetime ownership for argv/exit/status/progress/binary or JSON output. No shell, daemon, second supervisor or routing framework. Preserve native JSON-worker semantics. Progress is not completion; bounded stdout/stderr must drain without deadlock. Choose direct child topology where possible; any necessary wrapper must prove descendant retirement.

## Focused proof and review

A fake-worker fixture and one real bounded cancel probe.

Test noisy diagnostics, binary output, malformed probe JSON, nonzero exit, deadline, abort and exit-before-drain. Kill service/wrapper and prove all descendants stop before staging/capacity reuse. Retain bounded failure context without leaking unrelated content.

## Boundaries and decision budget

Inherit the [global contract](../README.md#contracts-and-ownership) and narrow verification policy. Write-tests red/green precedes behavior changes. Existing native output and persisted identity remain unchanged unless this slice names the extension.

Delegate internal naming/decomposition, bounded fixture selection and reversible artifact styling. Public meaning and backend policy are fixed above; resolve a new semantic choice in this spec before coding it. Record actual commands, immutable input/runtime identities, coverage, failures and verdict. User feedback changes requested meaning, supported scope or visible appearance; mechanical preferences alone do not justify expanding the slice. A failed proof remains unfinished and must be narrowed or resliced, not waived.

## Implemented contract and evidence

`apps/service/src/worker.ts` shares one process lifetime between native JSON-line
requests and bounded raw binary/JSON commands. CLI execution invokes the existing
native executable's private argv-only mode; no shell or second executable owner.
A private completion pipe follows caller descriptors, preserving their indices.
The wrapper marks this pipe close-on-exec, reports the actual CLI status there,
and keeps watching its parent until the service retires the known group. Malformed
or duplicate completion refuses success. Zero CLI exit certifies completion only
after pipe drain and kernel absence of
the known process group. A response/progress line cannot bypass that requirement.
Malformed JSON, invalid UTF-8, nonzero exit and aggregate output overflow refuse
completion. Inherited admitted descriptors survive the native wrapper unchanged.

The existing native parent watcher retires the whole CLI group on service death.
Service cancellation, deadline and unexpected wrapper exit kill that same group.
After five seconds of retirement overrun, the service logs once and polls once per
second while retaining owned capacity. This exceptional kernel wait has no finite
completion guarantee: releasing ownership while the group exists would violate
staging and task safety.

Focused checks (2026-10-04):

- `bun run --cwd apps/service test src/cli-worker.test.ts src/cli-worker-macos.test.ts src/worker.test.ts`: 20 cases, including binary bytes, diagnostics, malformed/invalid UTF-8 JSON, nonzero exit, deadline, abort, descriptor inheritance, wrapper/service death, and descendants that close every inherited pipe.
- The ignored-pipe regression uses 32 descendants and asserts group/PID absence at promise resolution. Disabling the retirement wait deliberately fails this assertion; restoring it passes. Removing the native parent-death group callback likewise fails the isolated service-death proof.
- `bun run --cwd apps/service build` and `check-types`; scoped `oxlint` passed. The macOS topology tests compile the two production Swift sources with a temporary entry point, without a full native package build.
- `node scripts/cli-worker-probe.mjs <prepared-ffmpeg>`: real zero-status completion, cancellation and isolated service SIGKILL retire observed FFmpeg/native PIDs. Immutable executable SHA-256 `02121755a76faf22413c61ba9f8e9cd3e2acc14fb6e29ecc3fc0b2cc83bbcbac`, version `9.0.2`; generated realtime lavfi sine input, no user media.

Toolchain: Node 24.21, Bun 1.4.2 (repo pin 1.3.14), Swift 6.4 on the macOS 27 host.
These proofs establish the production lifetime seam and selected prepared binary;
they do not establish full packaged app signing, installation or distribution
compatibility. Those remain the owning release checks. No demo edit or user state
was changed.

Independent review found and reproduced three lifetime bugs during development:
closed pipes could precede group retirement (fixed by the ESRCH fence); CLI exit
could end parent watching before service death (fixed by the private completion
channel); abort during retirement could be lost (listener now remains active until
settlement). The paused-service/finished-CLI descendant regression failed before
the handshake and passed after it. Deliberately restoring early abort-listener
removal returns success and fails the new cancellation regression; restoration
returns `CANCELED` after ownership drains. The paused-service test uses an isolated
host only; no live service or user state is stopped.

Follow-up independent review reported no findings after these corrections. Its C
command probe also confirmed inherited fd3/fd4 writes, an inaccessible completion
fd (`EBADF` after exec), and exact zero/nonzero/signal status. The shared service
`cli-owner.fixture.ts` compiles the same two production native sources in scratch
state for tests that need the owned topology; no second executable implementation
or release build is introduced.

Isolated service-death test hosts import the exact worker TypeScript source using
Node 24 type stripping, so an old service build cannot silently substitute a
previous lifetime contract. Compiled-worker/package proof remains separate in the
real prepared-tool smoke script and release integration checks.
