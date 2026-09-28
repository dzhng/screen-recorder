# Lifecycle provenance choices

## Sound

- Keep the existing finished-presence flag and add optional completion facts.
  Current presence-only inputs cannot prove a time or terminal outcome; treating
  them as interrupted would invent evidence. Confidence: high.
- Preserve the actual failure code only, excluding the potentially verbose failure
  message. It supplies a stable machine-readable reason without inflating retained
  provenance. Last lifecycle reason remains the native-reported string.
  Confidence: high.
- Use the finalized capture/video endpoint as the recorded termination boundary.
  No journal transition supplies failure-onset time, and selected audio may end
  earlier or later. Keep this limitation explicit for the event projection owner.
  Confidence: high.
- Charge header and new terminal facts to the existing native provenance budget
  together; refuse over-budget publication instead of silently dropping reason or
  completion. Confidence: high.
