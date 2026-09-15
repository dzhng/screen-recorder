# Native frame decoding checkpoint

The merged decoder selects a sample within the caller's kept interval and returns
its actual presentation time. The native worker exposes `media.frame`; the request
boundary is owned by `FrameOperation`, while `FrameSource` owns media execution.
No revision lookup, worker pool, cache, audio inspection or cursor overlay is
claimed here.

## Verification

Generated H.264 checks exercise nearest/tie selection, half-open cut boundaries,
empty intervals, sparse frames, oriented crops, image bounds and random access.
The timing oracle decodes the complete fixture independently of the selector.
`random-access.json` records twenty seeks into a ten-minute file: the latest run's
slowest seek was about 31 ms versus 2.85 seconds for a full sequential decode.
This is a generated small-raster benchmark, not a production-resolution guarantee.

The process-level worker test verifies a PNG and actual timestamp, structured
failures, continued service after malformed requests, and unchanged original bytes.
The Mac package's default test command includes both Swift media checks and Node
worker checks.

Root additionally decoded beginning, middle and final samples of the existing
five-minute own-window ScreenCaptureKit recording through the worker. The original
SHA-256 remained unchanged. `own-window.json` retains actual timestamps and byte
counts; all three PNGs are alongside it. No new screen or audio capture was needed.

Independent Codex review identified directory-alias source replacement and integer
overflow in crop validation. Both were reproduced, corrected and rerun green.
The red logs and final native test log are retained here. A second independent review of the worker integration reported no actionable
defects. Its runtime checks were limited by sandbox codec failures; root ran the
actual native suite and app build successfully outside that sandbox.

## Visual review

A fresh reviewer inspected all 38 generated PNGs, then all three own-window PNGs.
Root inspected the decoded reference, asymmetric crop and own-window middle image.
No full-frame corruption or missing corner labels was found. The quarter-turn
fixture matches the platform image-generator oracle. The own-window quadrants
remain upright, complete and readable; pale native title text and the platform's
changed screen-sharing indicator are faithfully retained.

The 64-pixel bound tests intentionally make labels tiny. Explicit crops intentionally
exclude labels and corners. The decoded fixture has a subtle color shift relative
to the uncompressed raster; the implementer's platform-oracle comparison attributes
this to the untagged H.264 round trip. This is accepted for the decoder checkpoint;
it is not evidence of color-managed archival fidelity. Generated images in
`generated/` preserve the complete reviewed set.

The repository comparison helper reproduced the generated reference comparison:
grayscale MAE 5.05873, pixel mismatch ratio 0.00818, edge-energy ratio 1.05822.
The target is intact asymmetry, labels and frame identity after H.264 compression;
these metrics locate the color divergence but do not decide acceptance. The
`comparison/` artifacts contain the full measurement. The helper used
`/Users/david/dev/game` only to locate existing pngjs/pixelmatch dependencies;
reference and candidate files came from this report's reviewed generated images.

Two review images were opened in one Preview invocation at approximately 09:00 UTC
for the non-blocking human checkpoint. Close that set after the review window.
