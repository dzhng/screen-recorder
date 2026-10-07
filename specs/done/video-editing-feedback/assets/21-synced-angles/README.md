# Native switched-angle delivery

`packages/test-harness/editing/switched-angle-delivery.mjs` is the case-selected
public replay for slice 21. It authors three one-second H.264 camera controls
(solid red, green and blue), imports each through `asset.import`, creates one
video track with explicit sequential placements, and declares a three-member
angle session through `angle.declare`. The accepted synchronization receipt is
source-bound to the imported asset/stream identities; no camera is selected or
retimed by the relationship.

The retained `native/` run exercised CLI and MCP admission, native `frame.get`
for each interval, and native `preview.get` for the complete six-frame 2 fps
project. The frame receipts select the red A source at 0.25s, green B at 1.25s,
and blue C at 2.25s. Decoded means are `[246,36,0]`, `[63,251,0]` and
`[26,34,255]`; the preview repeats each source for its two declared frames.
The source clips, preview, PNG controls, native worker receipts and complete
JSON report are retained for replay, with the source hashes recorded in the
report's frame layers and the file hashes below.

```text
YAP_NATIVE=helpers/mac/.build/out/Products/Debug/yap-native \
  node packages/test-harness/editing/switched-angle-delivery.mjs \
  --out specs/done/video-editing-feedback/assets/21-synced-angles/native
```

The compiler-level switch and this native delivery prove caller-authored
sequential placement and delivery only. They do not promote slice 20's refused
real unlike-microphone synchronization hypothesis, infer a speaker from an
angle, or choose a camera automatically. A fresh visual critique is limited to
the flat-color controls: all retained frames are opaque, fully filled and show
the expected dominant source color. The repository screenshot comparator could
not run because this checkout lacks its optional `pngjs` dependency; decoded
means and native frame-layer receipts remain the objective gate.

Retained source and preview hashes:

```text
angle-A.mp4             fa673b448800be4d19ea74bb91cd5caa51a6b8cb10314953c71b2b599aaaacdb
angle-B.mp4             eca43caff26556cdc413de14cc5c6e8606b11b05b99c1ff3e41303816514d856
angle-C.mp4             87842eb3e718ef7b7d345f20af32c8097c38d7b1e83eb1cddd49cabf0c2ba538
switched-angle-preview  7d9de0300768d1557d6be6b93286b70a2f450cf31243f7c3f25c0d0c9eda0f79
```
