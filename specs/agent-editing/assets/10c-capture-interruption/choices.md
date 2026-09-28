# Capture-end inspection choices

## Sound

- Treat capture termination as a closing boundary: `(start,end]` owns it, while
  ordinary observations remain `[start,end)`. A final marker then appears once
  without inventing a media sample beyond the end. Confidence: high.
- Suppress marker publication for damaged or contradictory terminal provenance,
  retaining the raw facts and an explicit unavailable reason. Missing records do
  not prove a crash, and conflicting claims do not prove normal completion.
  Confidence: high.
- Preserve the established sort key. Defer one prior endpoint while the next
  clip's opening observations merge, rather than changing order to suit the old
  concatenation assumption. Positive nonoverlapping clips bound this work.
  Confidence: high.
- Fence capture checkpoints independently from transcript queries. Their
  continuation state changed; transcript semantics and state did not.
  Confidence: high.
