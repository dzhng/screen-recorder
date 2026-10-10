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
