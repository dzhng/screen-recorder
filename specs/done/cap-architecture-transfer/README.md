# Cap architecture lessons for local Yap capture

This work transfers the useful local architecture from Cap at commit
[`2c51caae0a952340be7f57a95813e7c8d0d1df1d`](https://github.com/CapSoftware/Cap/tree/2c51caae0a952340be7f57a95813e7c8d0d1df1d)
into Yap's local capture path. It makes capture shutdown, recovery evidence,
preview reuse and operation discovery obey one-owner rules while keeping Yap's
public contract unchanged. Remote delivery, uploads and Cap's cloud project
model remain outside the product boundary.

## Why this shape exists

Yap already had the right public lifecycle surface: `stop` acknowledges the
start of finalization, `finalizationError` retains a retryable terminal problem,
and `CAPTURE_NOT_QUIET` fences deletion. Adding Cap's extra public
`Unconfirmed`/quiescence axis or a new recovery operation would make callers
answer the same lifecycle question through two paths. The useful Cap lesson is
therefore internal: cancellation is separate from joined work, terminal errors
stay inspectable, and ambiguous media stays retained until evidence proves what
happened.

The implementation also keeps validation at the boundary that owns the fact.
A native recovery receipt is parsed once before its source publication outcome
is interpreted. Preview behavior is measured at the existing cache boundary
before any new resource owner is introduced. CLI and MCP continue to project the
protocol operation catalog; app controls keep their native operation strings
covered by the same fixture rather than growing a second capability registry.

## Invariants

- Public recording states remain `preparing | recording | paused | finalizing |
  complete | interrupted | canceled`.
- `capture.stop` begins finalization; its acknowledgement never certifies that
  media is importable.
- Native closure must be proved before recovery or destructive deletion. An idle
  status that still names a take or source is retryable `CAPTURE_NOT_QUIET` and
  leaves the deletion intent and bytes in place.
- Recovery rejects malformed or unknown top-level receipt fields, validates
  source publication separately, and retains ambiguous media for retry.
- A warm preview for the same pinned revision and request options reuses the
  published result and leaves source bytes unchanged.
- `packages/protocol/src/operations.ts` is the machine-readable capability
  catalog projected by CLI and MCP; app operation strings are parity-checked
  against it by the protocol fixture.
- No remote delivery, upload operation, public quiescence field, public
  `unconfirmed` capture state, or `capture.recovery` operation is part of this
  local contract.

## Code pointers and proof

The lifecycle and deletion fence live in
[`apps/service/src/capture.ts`](../../../apps/service/src/capture.ts), with the
contradictory-idle regression pinned by
[`apps/service/src/capture-lifetime.test.ts`](../../../apps/service/src/capture-lifetime.test.ts).
The service's ownership rationale is in
[`apps/service/README.md`](../../../apps/service/README.md).

Strict receipt admission and publication evidence live in
[`packages/core/src/capture-publication.ts`](../../../packages/core/src/capture-publication.ts);
the focused parser tests are in
[`packages/core/src/capture-publication.test.ts`](../../../packages/core/src/capture-publication.test.ts),
and the durable core principle is documented in
[`packages/core/README.md`](../../../packages/core/README.md).

Preview cache reuse is pinned by
[`packages/core/src/project-preview.test.ts`](../../../packages/core/src/project-preview.test.ts).
The protocol catalog and app-facing parity fixture are
[`packages/protocol/src/operations.ts`](../../../packages/protocol/src/operations.ts),
[`packages/protocol/fixtures/app-capture-contract.json`](../../../packages/protocol/fixtures/app-capture-contract.json),
and [`packages/protocol/src/index.test.ts`](../../../packages/protocol/src/index.test.ts).
CLI/MCP derive their help and validation from the catalog; the fixture parses
the native app's operation strings against that same owner.

Focused verification passed for capture lifetime/finalization (28 tests),
capture/recovery integration (54), recovery receipt validation (2), preview
(17), protocol (29), and the combined protocol/core/preview run (48). A final
focused rerun over the changed lifecycle, recovery, preview and protocol files
passed 78 tests after the review fixes. Type checking passed across all nine
packages, and the changed receipt files pass lint.

A repository-wide `bun test` run was started after all four slices. It reported
only environment-gated macOS/setup failures in this checkout (missing Sparkle
framework, native worker/app artifacts, `YAP_NATIVE`, screen-recording
permission, and the installer's Node-version requirement), plus service
integration timeouts under that unavailable environment. The harness produced
no new output for roughly 20 minutes after those failures and was stopped with
SIGINT; no focused check reported a regression in this work.

## Decisions and rejected paths

The final implementation choices are recorded in
[`choices.md`](choices.md). The important rejected paths are:

- Cap's public `Unconfirmed` state and a second quiescence axis, because they
  would add a second lifecycle vocabulary to Yap's existing retry contract.
- A public `capture.recovery` operation, because status/get/stop retry already
  provide one lifecycle question with one caller path.
- A new preview API or timing threshold, because the existing warm cache already
  proves reuse deterministically.
- A mutable Cap-style timeline/project model, because Yap's immutable composition
  and revision owners already define the local editing boundary.
- A second app-owned capability registry, because it would drift from the
  protocol catalog that CLI and MCP already consume; native app strings are
  instead pinned by the shared parity fixture.

No visual baseline or screenshot gate applied: this transfer changed local
lifecycle and contract evidence, not rendered UI.
