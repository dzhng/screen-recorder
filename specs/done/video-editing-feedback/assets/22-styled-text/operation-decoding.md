# Native operation decoding

The compiled picture graph carries tone fields only on `sdr-correction`.
Other primitives must decode without them; a correction must still provide
both fields explicitly. The native operation struct now expresses that
distinction and introduces no defaults or compatibility reader.

`YapFrameTests --composition-identity` reuses the existing asymmetric PNG
identity/translation test. Before the fix it failed with
`DecodingError.keyNotFound: shadows` on the first clamp primitive. After the
fix it preserves every source RGBA sample, returns the image receipt and
renders the translated canvas correctly. `--sdr-correction` also passes and
now explicitly refuses an incomplete correction instead of supplying defaults.

The matching debug worker rebuilt successfully after the shared RNNoise
generated input passed its existing hash verifier. The public styled-sheet
checkpoint now delivers a PNG with equal CLI/MCP bytes. It reaches a separate
harness error: `verticalOffset` is a lower-left translation, so comparing it
as an increasing top-left position is invalid. That assertion must use glyph
bounds before public caption acceptance is claimed.

Shape review found one existing operation decoder and no added owner.
Code review retains required correction parameters at execution.
Documentation review keeps the narrower public limit explicit. Independent
Codex review exited successfully with a nonempty verdict and no findings;
it did not run tests in its read-only sandbox. No full repository run occurred.
