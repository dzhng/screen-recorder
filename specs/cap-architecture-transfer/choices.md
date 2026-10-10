# Implementation choices

## Sound — high confidence

### Require empty idle authority before settling deletion

When: slice 01.

If native says the device is idle but still names the take or source, deletion
now returns retryable `CAPTURE_NOT_QUIET` and retains the deletion intent and
bytes. Previously deletion treated the word `idle` alone as closure proof,
although recovery already required an idle response with no identities.

Gap: the plan prescribed preserving quietness semantics but did not address a
contradictory idle response. Reach: recovery and deletion now share the same
empty-idle proof; a different recording/paused take remains evidence that the
named take was released. Verdict: sound because an incomplete native report
cannot authorize destructive cleanup. Confidence: high.

### Keep the app parity fixture in the protocol package — high confidence

When: slice 04, commit `c48d7543`.

The macOS controls call capture and recording operations, while the CLI and MCP
already advertise the catalog. The fixture therefore lives beside the protocol
schemas and the test asks the catalog to parse the app's requests. It also wraps
native `finalizing`, retryable finalization error, and `complete` reports in the
shared response envelope before decoding them. The alternative would be an
app-owned operation list or a hand-written response shape, which could drift
from the public catalog.

Gap: the plan required an app-facing parity assertion but did not prescribe its
package or fixture format. Reach: future app controls can add a request fixture
without creating a second capability registry; lifecycle receipt changes fail at
the shared protocol boundary. Verdict: sound because `packages/protocol` is the
existing owner consumed by every adapter. Confidence: high.
### Use renderer invocation as the warm-preview probe

When: slice 03.

The plan asked for timing evidence, but elapsed time is noisy on a shared
machine and a single fast run would not prove reuse. The focused preview test
instead counts calls to the existing renderer: the first request is the cold
render, and the next request for the same pinned revision must be ready without
another call. It also compares the source bytes before and after both requests.
This observes the caller-visible cache contract without adding a timing API or
coupling the test to a scheduler duration.

Gap: the plan did not prescribe how to measure warm setup. Reach: future
preview optimizations must preserve the existing cache boundary and source
immutability; a timing benchmark can be added separately if a real performance
regression appears. Verdict: sound because renderer reuse is deterministic
evidence of the behavior under review and avoids a flaky threshold. Confidence:
high.
