# Final implementation choices

This ledger records decisions the implementation had to make where the plan
left the exact seam open. User-directed scope decisions (keeping Yap's public
lifecycle, omitting remote delivery, and declining new public recovery states)
are recorded in the spec rationale rather than repeated here.

## Sound — high confidence

### Put the strict recovery receipt parser in core publication

**When:** slice 02, commit `bc9f0c90`.

**The choice:** A native recovery worker returns one JSON receipt containing
duration, journal facts, track failures, cleanup diagnostics and a source
publication result. The service used to cast that JSON and validate pieces of it
locally. The implementation makes `readRecoveryReceipt` in
`packages/core/src/capture-publication.ts` the single boundary parser: it checks
the bounded shape and rejects unknown top-level fields, then the existing source
publication reader checks the media authority separately. If a receipt is
malformed, recovery remains retryable and the bytes stay on disk.

**The gap:** The plan required one strict evidence owner but did not prescribe
whether that owner belonged to the service or core.

**The reach:** Future native receipt fields and bounds are added once at the
shared boundary. Recovery execution still belongs to native/service, while
publication identity keeps its own validator.

**Verdict:** Sound. The parser sits with the other publication evidence owners
and prevents every adapter from inventing its own interpretation.

**Confidence:** High.

### Keep the app parity fixture beside the protocol catalog

**When:** slice 04, commit `c48d7543`.

**The choice:** The macOS controls issue capture and recording operations, while
the CLI and MCP adapters discover names from `packages/protocol/src/operations.ts`.
The fixture `packages/protocol/fixtures/app-capture-contract.json` therefore
stores the app-facing requests next to the schemas. A protocol test parses every
fixture request through the catalog and decodes finalizing, retryable-error and
complete reports through the shared response envelope. A misspelled operation or
changed lifecycle shape fails at this boundary instead of creating an app-only
registry.

**The gap:** The plan required an app-facing parity assertion but did not choose
its package or fixture format.

**The reach:** New app controls extend one fixture and continue to exercise the
same catalog consumed by CLI and MCP. There is no second capability owner to
keep synchronized.

**Verdict:** Sound. The protocol package already owns the public machine-readable
contract, so the test follows existing ownership.

**Confidence:** High.

### Use renderer calls as deterministic warm-preview evidence

**When:** slice 03, commit `8c7d445e`.

**The choice:** Cap reuses open-editor decoders and GPU resources for a warm
preview. Yap already publishes a cached preview for a pinned revision. Instead
of adding a timing API or a scheduler threshold, the test wraps the existing
renderer, requests the same revision twice, and asserts one cold render followed
by a ready warm response. It also compares source bytes before and after both
requests. The test observes the cache contract directly and avoids a flaky wall
clock measurement.

**The gap:** The plan asked for measurement but did not specify how to distinguish
reuse from a second render.

**The reach:** Future preview changes must preserve the existing cache boundary
and source immutability. A timing benchmark can be added only if a real
performance problem appears.

**Verdict:** Sound. Renderer invocation count is deterministic evidence of reuse
and proves the behavior callers depend on.

**Confidence:** High.

### Require an empty idle report before destructive deletion

**When:** slice 01, commit `9dd49a6b`.

**The choice:** Deletion asks native to cancel a take and then reads device
status. An `idle` word by itself is insufficient if the same response still
names the take or its source; those identities mean native has not proved that
the writer released the bytes. `nativeReleaseProven` now accepts either a truly
empty idle report or a different take that is actively recording/paused. The
ambiguous case returns retryable `CAPTURE_NOT_QUIET`, keeps the deletion intent,
and retains the source directory.

**The gap:** The plan describes shared quiescence discipline but did not call out
contradictory idle responses.

**The reach:** Every cleanup path must use the same native closure proof before
removing bytes. A future native status field cannot silently turn an incomplete
report into deletion authority.

**Verdict:** Sound. Destructive cleanup now requires positive evidence that the
named writer is gone.

**Confidence:** High.
