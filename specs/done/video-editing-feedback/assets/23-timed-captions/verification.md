# Scoped checks

- Corrected/wrapped helper mapping went red with absent `timedWords`, then green.
  The unfixed scratch helper also falsifies the later fragmented-support test.
  All 15 helper tests pass.
- The compiled-text/native boundary went red on an unknown-field refusal; its
  narrowed schema regression then failed on the leaked authored windows. All six
  composition text tests pass after resolving and stripping them.
- All nine core text-seed tests pass, including ordinary seed/source preservation,
  retiming and split behavior.
- Composition and service typechecks pass. Protocol, composition, client,
  service and CLI builds pass. Core emits its local output but its build retains
  four inherited `faceObservationRequest` type errors in source/project index
  materialization at base `98b331b2`; the separate face pass owns those errors.
- Changed-code lint and formatting pass. No whole-repository suite was run.
- Actual public CLI/MCP/native checkpoint passes: 15 exact full-raster still
  comparisons, 48 encoded numeric-reference frames with zero caption MAE, nine
  offgrid preview samples with maximum caption MAE 0.1083951 under the declared
  bound of 3, and exact full-preview/committed-export bytes. Captured repeat,
  caption/source split and twice-as-fast retime comparisons preserve pixels.
- The independent reviewer's attempted package test could not create its cache
  in the read-only sandbox; it ran no test cases and is not counted as green.
  Independent code triage and the last fresh image-only critique are retained.

The native worker is the isolated base-98 snapshot with rounded glyph strokes:
SHA256 `d124c21fb438c3021a4f5acf8400d706717b80537d6ee5de49cd985f1b0ea9fd`.
Native source did not change. Frame/movie generated-request identities advance to
`native-composition-picture-v19` and `native-composition-movie-v23`; integration
must preserve all existing capability suffixes.
