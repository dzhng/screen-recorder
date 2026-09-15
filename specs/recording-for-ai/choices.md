# Implementation choices

## Bootstrap and tooling

### Local bundle identity

- **When:** bootstrap.
- **Decision:** build a locally ad-hoc-signed ScreenRecorder.app with stable bundle
  identifier com.david.screenrec. Its status-bar label is ScreenRec.
- **Gap:** the project had no product name, signing identity or distribution setup.
- **Rationale:** a stable local app identity supports later macOS permission testing;
  public signing/notarization belongs to the separately planned public release.
- **Consequence:** the personal build needs no distribution account; public release
  must explicitly choose its signing and product identity.

### Build dependency pins

- **When:** bootstrap.
- **Decision:** pin the installed registry versions of TypeScript, Vitest, Turbo,
  oxfmt, oxlint, Zod and Node 24 types; Bun and Node retain the spec's runtime split.
- **Gap:** the spec delegated exact dependency versions.
- **Rationale:** one lockfile and exact direct versions make the initial toolchain
  reproducible rather than copying another repo's older numbers without a reason.
- **Consequence:** updates are deliberate dependency changes and require focused checks.

### Native build caching

- **When:** bootstrap.
- **Decision:** disable Turbo caching for the native bundle build and process/conformance tests;
  include the shared TypeScript compiler config in global cache inputs.
- **Gap:** package-local build outputs do not describe the root .app directory.
- **Rationale:** a cached success must not skip creating the actual app after output
  deletion. Swift already performs incremental compilation.
- **Consequence:** root builds always invoke native packaging/signing, and native process checks
  execute even when inputs outside the app package change.

## Actual-agent inspection

### Evidence without personal recordings

- **When:** image-access gate.
- **Decision:** use randomly generated digit PNGs and an isolated Claude Code
  session to prove both MCP image blocks and CLI-file image ingestion.
- **Gap:** the spec needed an actual-client proof before any recorded fixture existed.
- **Rationale:** hidden expected text plus retained tool exchanges distinguishes
  seeing pixels from receiving a plausible file path or inferring a scripted answer.
- **Consequence:** this establishes the transport/client boundary only; readability
  of real screen recordings and the eventual edit loop still need their own gates.

## Speech evaluation

### Repeated-word alignment

- **When:** local speech preparation.
- **Decision:** compare words in order, then use their times to break equally good
  text matches. A repeated “like” close to the observed audio is preferred over a
  distant occurrence; timing never excuses a worse transcription.
- **Gap:** the acceptance gate specifies timing accuracy but not ambiguous matching.
- **Rationale:** choosing the last repeated occurrence by array order can turn one
  omitted word into an invented multi-second timing error. Sequence plus proximity
  preserves the distinction between missing words and bad boundaries.
- **Consequence:** ambiguous matches use the reference timing; this small annotated
  evaluation remains evidence for the fixture, not universal speech accuracy.

### Keep raw inference evidence

- **When:** local speech preparation.
- **Decision:** preserve upstream reports in a separate directory beside normalized
  results, including when the recording itself is named “result”.
- **Gap:** diagnostic layout was unspecified.
- **Rationale:** separate paths prevent filename collisions without rejecting valid
  recording names. Raw confidence/segment data remains available for review.
- **Consequence:** the test harness retains both reports; production artifact layout
  remains owned by the processing slice.

## Revision persistence

### Bound database contention

- **When:** durable revision transactions.
- **Decision:** wait at most one second for a competing SQLite writer, then return
  retryable `STORAGE_BUSY`. The same request ID can safely be retried.
- **Gap:** the spec required bounded waiting but did not choose the duration.
- **Rationale:** edit transactions are short; brief contention should succeed while
  a held lock must not freeze the caller indefinitely. No custom retry loop or
  second storage authority is needed.
- **Consequence:** lock contention can surface as a retryable result. The service
  must keep encoding and transcription outside these transactions.

## Local transport

### Sound — medium confidence

#### Accept a request when its complete JSON line arrives

- **When:** 06b local transport.
- **Choice:** A client sends a JSON message ending in a newline and keeps the socket open while waiting. Once that valid bounded line arrives, the service may run its handler. Waiting for the client to close its writing side would prevent the server from observing a later disconnect on the tested Node Unix sockets. Later bytes cannot undo an already accepted edit.
- **Gap:** The plan specified one request per connection but did not specify whether newline or end-of-stream establishes acceptance.
- **Reach:** All clients must use the same framing convention; handlers receive a cancellation signal when the live connection closes. The returned signal cannot reverse a committed database transaction.
- **Verdict:** Sound. This keeps client disconnects observable without adding a session or acknowledgement protocol; the framing parser rejects invalid or oversized frames before dispatch.
- **Confidence:** Medium.

#### Put correlation ID alongside the operation result

- **When:** 06b local transport.
- **Choice:** A response contains the caller's `id` together with `ok` and either `data` or `error`. A client verifies this ID against the request snapshot it actually sent. Reusing the caller's JavaScript request object for another operation cannot change that in-flight comparison.
- **Gap:** The plan required a correlated typed envelope but left its exact outer shape unspecified.
- **Reach:** Future CLI and MCP adapters can pass through the same operation result without another nested transport result object. Existing request parsing remains strict; response parsing tolerates additive metadata according to the project review rules.
- **Verdict:** Sound. One shared protocol schema owns both success/error variants and their correlated response forms.
- **Confidence:** Medium.

#### Close invalid request connections; keep operation failures structured

- **When:** 06b local transport.
- **Choice:** If incoming bytes or the request envelope are invalid, the service closes that connection without invoking a handler. It does not invent a trusted request ID from malformed data. A valid request whose handler fails receives a correlated error; an oversized handler result produces `LIMIT_EXCEEDED`. Such an error does not imply that a prior mutation was rolled back.
- **Gap:** The plan required rejection but left server-side error behavior for uncorrelatable input and oversized output unspecified.
- **Reach:** Clients distinguish transport failures from domain results and retain request IDs for explicit replay after uncertain outcomes. Registry/domain handlers remain responsible for actionable domain errors; unexpected thrown failures become a generic internal error.
- **Verdict:** Sound. This avoids dispatching malformed requests or leaking arbitrary internal exception text while retaining correlated errors wherever an accepted ID exists.
- **Confidence:** Medium.

### Sound — high confidence

#### Refuse a pre-existing runtime directory that is not already private

- **When:** 06b local transport.
- **Choice:** The listener creates missing directories privately, but an existing directory must already be owned by the current user with mode 0700. If somebody passes a shared directory such as `/tmp`, startup refuses it instead of changing that directory's permissions. The actual socket is set to 0600.
- **Gap:** The plan required a private runtime directory without specifying repair behavior for an existing unsuitable path.
- **Reach:** Application setup must supply its own private runtime directory. The listener never changes access to unrelated pre-existing directories.
- **Verdict:** Sound. It meets the privacy contract without changing arbitrary user filesystem permissions.
- **Confidence:** High.

The no-live-unlink invariant and direct libuv-owned socket cleanup were explicitly clarified by the parent during this pass and should be treated as the updated plan, not a new inferred lifecycle mechanism. Internal names, fixture locations, and package scripts follow delegated implementation discretion.
