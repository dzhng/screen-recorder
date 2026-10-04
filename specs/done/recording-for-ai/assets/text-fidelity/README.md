# Browser text fidelity

The reference is the appearance of the captured source at its original pixel
size. A renderer must preserve readable small labels, punctuation and colored
code without hiding differences through resizing or sharpening. The captured
source is itself H.264, so source antialiasing and compression are not evidence
of a renderer regression.

[Open the full comparison gallery](gallery.html).
[Verification and review resolutions](verification.md).

## Controlled comparison

[The owned WKWebView fixture](../../../../../helpers/mac/Tests/TextFidelity)
uses generated local content, light/dark views and scrolling at two window
sizes. Only those known windows were captured; both audio roles were disabled.
The native source and rendered PNGs have matching dimensions and sample times.
All variants use the same source bytes and core four-second original-revision
plan. No effects, scaling, color changes, profile changes or timing changes
were introduced. The experiment only added `AVVideoAverageBitRateKey` to the
existing compression dictionary at two, four or eight bits per source pixel per
second. The production setting leaves that value to AVFoundation.

Reports pin the worker binary SHA, source SHA, output SHA, native receipt,
independent container metadata, sampled timestamps, elapsed time and process
maximum RSS. The experiment base is `8dfe6a2`. `metrics.json` records full-frame
source-distance measurements; these locate differences, not readability wins.
`labels.json` reveals the neutral labels only after visual review. Every sampled
state and variant is retained, with fixed-layout 2× nearest-neighbor crops.
The WebP copies are lossless: their decoded RGB bytes were checked against the
reviewed PNGs, so the smaller evidence format adds no visual transformation.

## Measured tradeoff

| Setting | 2560×1664 bytes | 2048×1464 bytes |
| --- | ---: | ---: |
| Automatic | 1,924,009 | 1,502,189 |
| 2 bits/pixel/second | 1,440,800 | 1,090,726 |
| 4 bits/pixel/second | 1,725,485 | 1,331,279 |
| 8 bits/pixel/second | 2,016,776 | 1,569,335 |

The smaller explicit settings increase source-distance on every sampled view.
The largest setting reduces grayscale RMSE slightly: automatic 0.916–2.448
versus 0.888–2.378 across the eight samples. It costs approximately 4.5–4.8%
more storage on these short captures. Automatic and largest-setting repeats
produce identical respective media bytes. Their measured render times overlap
(automatic 0.873–1.195 seconds, largest 0.840–1.574 seconds); these short runs do
not establish a throughput advantage. Maximum process RSS stays approximately
43–44 MB. This is not a long-duration encoder memory claim.

## Decision

Keep automatic bitrate. The [fresh image-only review](visual-review.md) inspected
all 40 full frames and eight crop sheets without knowing the variant mapping.
It found readable punctuation and labels across all variants, no conspicuous
full-frame blocking or halos, and no consistent readability advantage for the
largest bitrate over automatic. The four-bit variant was slightly worse under
enlargement. The largest setting's small numerical improvement is insufficient
to justify a new global quality/storage policy. No production code changes.

Dim dark navigation and softer secondary text occur in the source too; they
belong to the generated fixture, not a renderer fix. Viewer scaling limits
full-frame pixel judgment, so the explicit enlarged crops supplement it. The
state named `scrolling` is only a timestamp sample: the smaller capture still
shows the initial composition there. This pass does not certify motion quality.
The result supports readable source-relative browser text in this bounded set,
not pixel-perfect reconstruction or a claim that every earlier tiny label
artifact has disappeared.

## Scope and reproduction

A fresh checkout needs Node 24, Bun, Xcode command-line tools, FFmpeg/ffprobe
on PATH, screen-recording permission for the bundled app, and a graphical login.
Install workspace dependencies and build the app bundle (which builds its
workspace dependencies), then build the separate native worker. For example:

```sh
bun install
bun run build
swift build --package-path helpers/mac --product screenrec-native
SCREENREC_TEXT_EVIDENCE=/tmp/browser-text-evidence node --test helpers/mac/Tests/TextFidelity/capture.mjs
node helpers/mac/Tests/TextFidelity/render.mjs /tmp/browser-text-evidence automatic "$PWD/helpers/mac/.build/debug/screenrec-native"
```

The evidence directory must be empty before capture. It uses the bundled
app selected by the existing macOS harness; `SCREENREC_TEXT_CAPTURE_ROOT` can
select another checkout's already-built bundle. Run `render.mjs` with the
capture directory, a fresh label and an absolute native worker path. The driver
uses actual native frame extraction, compares exact frame times/dimensions,
checks immutable sources and verifies the output container independently.

The comparison deliberately uses an interior four-second range. One original
capture reported 4,316,788 µs at stop while its container ended at 4,316,667 µs;
a full-original plan correctly hit the renderer's usable-source bound. This
separate duration-authority issue was unresolved in this comparison. It is now
addressed by the [capture clock fix](../capture-duration/README.md), without clamping
renderer plans. The original fixture retained source bytes and stop duration but
not its journal. The capture driver now preserves complete source directories
and stop receipts; a verification rerun retained those and showed rounding in
the opposite direction. This evidence does not certify full-original export,
public preview, pointer rendering, audio, or universal screen-content fidelity.
