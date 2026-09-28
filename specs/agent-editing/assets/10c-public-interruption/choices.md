# Public interruption integration choices

## Sound

- Extend the existing capture journey and independent occurrence oracle. Separate
  endpoint fixtures add no parallel runtime reader or service adapter. Confidence: high.
- Preserve presence-only completion and lifecycle-only interruption as explicit
  unknown coverage in actual public imports; do not silently upgrade legacy journal
  facts into timed events. Confidence: high.
- Keep source parameter namespaces exclusive and pass the complete returned cursor.
  The public schema must represent the reader's interruption head without adding
  fictitious recording/project revision fields. Confidence: high.
- Treat service shutdown failure as a failed journey and always remove the scratch
  home even if evidence writing fails. Successful assertions cannot hide incomplete
  teardown. Confidence: high.
