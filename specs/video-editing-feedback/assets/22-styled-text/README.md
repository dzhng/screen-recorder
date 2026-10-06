# Styled text layout evidence

Slice22A retains the native `YapFrameTests --text-vertical` checkpoint. It exercises
real CoreText Arial glyphs for omitted/top, center, bottom, clipping and empty text.
The first independent review found that empty text needed an explicit zero-bounds
receipt; that correction is in the shipped checkpoint and the focused test is green.
Decoration and public caption-sheet evidence remain open for 22B.

## Public static-sheet checkpoint

`packages/test-harness/editing/captions.mjs --case styled-sheet` now drives the
public CLI/MCP journey through `frame.get`. It places four captions in one
static frame: omitted/top placement, centered stroke, bottom shadow and centered
rounded background. The output receipt is keyed by clip identity and must retain
literal text, vertical offsets, each requested decoration and bounds containing
the glyph ink. The same frame PNG is retained as `styled-caption-sheet.png` in
the caller-owned evidence directory, so the visual artifact and its receipt
share one public request.

Run it with a freshly built native worker:

```sh
YAP_NATIVE=/absolute/path/to/yap-native \
  node packages/test-harness/editing/captions.mjs \
  --case styled-sheet --out /empty/evidence/22-styled-text
```

The public admission attempt and fresh visual critique are recorded in
[public-admission.md](public-admission.md) and
[visual-critique.md](visual-critique.md). Service admission reached the queued
`frame.get` job, but the available native worker returned `Malformed picture
receipt`; a matching rebuild was blocked by the missing generated RNNoise source.
The isolated native vertical/decorations checks pass, while the public PNG and
receipt remain unverified. The runner makes no listening, watching or human
sign-off claim; its gate is public admission, rendered receipt fields and
retained PNG bytes.
