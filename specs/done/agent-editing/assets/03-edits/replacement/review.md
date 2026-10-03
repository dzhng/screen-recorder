# Interval-preserving replacement

The pure reducer replaces an explicit audio/video occurrence while retaining its
identity, placement and unaffected synchronization members. `exact` rejects a
source duration mismatch; `trim` restricts an explicitly longer selection;
`stretch` retains the supplied selection and maps it to the target interval.
Pitch preservation is authored policy here, not a claim of native execution.

All 62 composition tests, type checking and build pass. Tests cover audio-only
replacement with unchanged video, no-op replay, explicit media kind, duration
mismatch, attachment removal, invalid-batch immutability, trim and stretch,
and explicit pitch following. A separate public-surface probe verified fractional
trim, normalized-attachment removal and same-source no-op preservation.

Independent Codex review found that trimming could mask an out-of-bounds supplied
selection. The [red regression](source-bounds-red.txt) precedes the fix. Placement
and replacement now share the same source validator, applied before fitting.
Follow-up review verified the fix, passed all 43 edit tests and type checking,
and found no remaining actionable defects within this scope.

The subsequent [ripple fit](ripple-review.md) has its own evidence. Hold tails,
explicit silence padding and the full linked-replacement harness are unfinished. This checkpoint does not accept the
whole structural-edit slice or expose a public managed-project editing route.
