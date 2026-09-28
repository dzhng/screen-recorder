# Matched native encoder cohort

The input is all 24 actual pre-append BGRA buffers from the parent public zoom
journey, including original timestamps, durations and the same declared color
space. The standalone AVAssetWriter probe reproduces the production H.264 movie's
decoded pixels exactly (24 frames, 245,760 RGBA bytes). It therefore supplies a matched
baseline before changing encoder settings. These are video-only files; the public
movie also has its separate audio/mux boundary.

| Variant | Maximum RGB error across eight color-managed samples | Video bytes | Verdict |
| --- | --- | --- | --- |
| Native default H.264 | 186 | 4,855 | Retain baseline; edge quality unresolved. |
| H.264 requested 40 Mbps | 185 | 5,133 | Discard as a fix for this cohort's large edge errors. |
| ProRes 4444 MOV | 2 | 28,679 | Provisional high-fidelity reference on this cohort only. |

Every ProRes sample satisfies the unchanged four-level whole-pixel color check;
no pixel/channel is excluded except alpha, whose inputs are opaque. Its mean RGB
errors range 0.045–0.167. Default and higher-rate H.264 remain far outside that check.
Codec/container and removal of the H.264-only frame-reordering setting are a coupled
ProRes candidate, not independently attributed changes. File sizes from this small
mostly static three-second sequence are not general bitrate or resource measurements.

`FrozenWriter.swift` accepts a directory containing unpacked `../full/frame-N.json`
and `.bgra` files, a new output path, and `h264`, `h26440mbps` or `prores4444`.
Compile it with `swiftc -parse-as-library`, then run each variant. The output code
copies actual pixels rather than rerendering or changing the composition graph.
For display comparisons use the repository's `FrameColorReference.swift` at
2,000,000 through 2,875,000 us in 125,000 us increments, then `FrameImagePixels.swift`
and the original zoom PNGs. Reports retain decoder/profile/timestamp receipts.
The initial source/binary identities and the later bitrate-only source extension
are both retained. Baseline decoded parity was established before either candidate
was evaluated; the high-rate branch does not alter default or ProRes settings.

No production profile or default changed. Native movie quality still needs realistic
resolution, text/detail, moving footage, full/range/export, audio and resource
verification. The next research step is that representative cohort before promoting
an optional high-fidelity profile or selecting practical H.264 quality settings.
Independent code review verified source/input hashes, baseline decoded parity,
movie metadata/timestamps and retained RGB statistics without actionable findings;
it did not rerun native encoding or color conversion. Fresh visual review inspected
all 32 originals and four sheets: ProRes was closest at every timestamp, preserving
edges/solid colors while both H.264 variants showed fringes and spill. The reviewer
could not consistently rank default versus higher rate. This supports only these
small still samples, not motion or general export quality.

The ProRes AVFoundation-to-PNG comparison path produces alpha 254 everywhere, while
the same file decoded by FFmpeg yields 255. Including alpha still meets the four-level
numerical check, but full opacity is not assumed and transparency fidelity remains
unverified. This is an observed decode-path difference, not an established encoder
cause. The RGB result does not erase it.
