# Native still-image prerequisite

Status: native behavior checks and fixture-scoped fresh visual review pass; public source/project integration remains open. This is an internal native operation, not an advertised public capability.

A PNG or JPEG has pixels and an orientation, not a presentation timestamp. The shared still source owns import metadata and decoded pixels; raw image delivery reuses the existing frame sizing and PNG publication owner. Project composition must consume that same source rather than fabricate a video sample. Timed source evidence remains separate.

The [native journey](../../../../packages/test-harness/editing/still-image-native.mjs) drives the actual worker. Its [report](report.json) records all eight orientations for both PNG and JPEG, alpha, sizing, unchanged imported bytes, malformed/truncated/animated refusal, decode/encode limits and strict request validation. Expected pixels come from explicit CPU reindexing of the encoded source, independently of Core Image orientation. Normalized premultiplied sRGB RGBA differs by at most one code value, below the unchanged two-value gate.

The [complete comparison sheets](sheets/) place the independent reference on the left and native output on the right at four-times nearest-neighbor scale, in ascending orientation order. Checkerboard compositing makes transparent and half-transparent pixels visible. Original source, reference and delivered PNGs remain alongside normalized raw bytes. The small bounded image has its own enlargement. [Fresh critique](visual-review.md) found no visible defects in the paired fixtures; its explicit limits include bounded resampling and photographic detail.

Removing the caller decode-budget check made the same journey fail because an image was published for a one-pixel budget. Restoring it returned green. All eight refusal cases leave no output. The existing native frame executable passed, including crop/overlay, presentation membership and random access into ten-minute media; the existing media-probe suite passed seven tests. Four normal/rotated video pictures at two sizes remain byte-identical to the frozen pre-change worker. This proves preservation of those video cases, not broader codec or release-scale performance.

The worker was built in a separate scratch build directory and frozen; its hash is in the report. Reproduce with `SCREENREC_NATIVE=<frozen-worker> node packages/test-harness/editing/still-image-native.mjs --out <fresh-directory> --baseline <prior-worker>`. The baseline option adds existing video-path preservation checks. Source/project frame routing, retained index behavior for images, delivery/cache lifetimes and actual CLI/MCP image journeys are the next gates.

Review: the shape pass consolidated ImageIO admission and reused existing output ownership; the diff and documentation pass found no unresolved defects. Independent Codex review found no actionable defects, but its sandbox could not run the Swift fixture because of module-cache/toolchain permissions. The runtime claims above come from the successful unsandboxed isolated native checks, not that review. [Root integration](integrated.json) reruns all 16 image cases, eight refusals and four byte-identical video preservation cases successfully. Native sources exactly match the reviewed implementation; the fixture-scoped fresh visual verdict is retained separately.

[Combined native verification](../10d-inspection-integration/README.md) also passes
this journey alongside retained project indexes and the other picture path.
