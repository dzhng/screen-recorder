# Choices

- **Sound, high confidence: source address owns sample identity.** A physical run
  retains one sample origin even when acquisition masks trim its support. The
  reader counts native samples; timestamps cannot label payload after a seek.
  Existing composition/source timing still owns placement, not a second timeline.
- **Sound, high confidence: interior cell request.** A microsecond coordinate
  strictly inside an already selected native sample avoids unrepresentable rational
  timescales. This is a bounded representation of that same sample, not a fitted
  offset or a different selection-rounding rule. Negative origins remain possible.
- **Sound, high confidence: preserve bounded work and original behavior.** Two
  packet widths of lookbehind, buffer reuse within a physical run, single tail
  retry and converter lookahead remain. Packet continuity checks compare on the
  decoded sample grid without using those timestamps as payload addresses.
- **Sound, high confidence: invalidate affected execution recipes.** New source,
  project/movie and transcript identities prevent old ready PCM satisfying new
  work. Existing prepared/acoustic dependency identity supplies downstream changes;
  no extra cache, registry or picture-only version was introduced.
- **Sound, high confidence: fixture and acceptance boundaries.** Test export setup
  failures remain visible, while exact PCM assertions and legacy thresholds remain
  unchanged. Capture journal/writer changes, physical recording and listening are
  separate gates. This correction does not claim whole-slice acceptance.
