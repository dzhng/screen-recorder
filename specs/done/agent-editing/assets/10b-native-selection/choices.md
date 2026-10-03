# Native selection choices

All entries are sound; no user-only decision or unresolved implementation choice
was introduced in this prerequisite.

- **Neutral PCM reports, recording roles at receipts — high confidence.** When
  speech selects a stream, it should not need to call that stream narration.
  The existing PCM stream now reports what each source supplied without a role;
  recording audio/movie receipt writers add their own actual role. The contract
  required shared decoding but left the internal report seam open. This keeps
  one converter and mixer while allowing later raw selected-stream WAVE output.
- **Rejection is an invalid selection — high confidence.** A request without a
  stream ID cannot choose between two audio streams. It returns INVALID_REQUEST;
  an explicit nonexistent stream keeps the existing decode-failure boundary.
  The contract required refusal but did not name its error code. No ordering or
  first-stream fallback becomes editorial intent.
- **Exact transcript comparison excludes runtime only — high confidence.** Two
  runs take different wall-clock time even when they hear identical samples.
  The parity check removes only the raw engine result's processingTime value;
  it compares all words, tokens, confidence and timing exactly. This preserves
  the frozen recipe without mistaking execution duration for transcript content.
