# Explicit replacement tails

Hold and silence fits expand a shorter supplied range into a natural-speed media
prefix and a linked ordinary tail. Exact placement is shared with split/trim and
move/retime, so fitting does not invent a temporary cut through the old source
clock. The returned lineage exposes both occurrence IDs.

All 69 composition tests, type checking and build pass. The [retained grid](probe.mjs)
checks 420 hold/silence fits and their linked retimes with 17,220 source/envelope
queries; [results](probe.json) also confirm caller immutability. Focused tests
cover sole final-clip duration, fractional boundaries, unchanged linked media,
selected versus linked removal, no-op repeat, and explicit attachment retention
through detach.

Independent review found that filtering a one-member group before adding the
tail lost its existing identity. The [red regression](group-red.txt) precedes the
fix. Final group filtering now follows expansion. Follow-up review passed all
49 edit tests and type checking, plus hold/silence probes for original group
identity, unrelated undersized-group cleanup, nested attachment removal, atomic
failures, allocation collision and deterministic replay. No actionable defects
remained in the reviewed scope.

Native execution and the full linked-replacement harness are separate gates.
