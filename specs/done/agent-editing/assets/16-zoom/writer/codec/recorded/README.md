# Recorded-screen encoder and decoder cohort

Two one-second windows (source 0 and 60 seconds) of the local narrated-workbench
fixture are composed at 1920×1080 and 30 fps. Each movie uses the same 30 captured
pre-append BGRA buffers and timestamps for its window. Baseline standalone H.264
has exactly the same decoded bytes as the public preview. The prior default
1600-pixel frame deliveries were unsuitable for this comparison; explicit
1920-pixel deliveries exposed the separately fixed composed-PNG boundary issue.
The corrected eight public PNGs match writer buffers within one RGB level after
ICC conversion. Neither correction relaxes the existing four-level gate.

## Decoder-dependent result

The [image-generator measurements](image-generator.json) compare four actual
movie presentation timestamps per window. Direct requests at 666667 and 966667 us
select pictures whose compiled PTS are 666666 and 966666 us; the reference decoder
must request those exact PTS. The initial exact-time assertion correctly rejected
the one-microsecond mismatch; it was not removed or widened.

Default H.264 has maximum RGB differences of 116–123 in the first window and
120–121 in the second. Requesting 40 Mbps modestly reduces mean error without
removing the isolated errors. ProRes 4444 reduces mean error but still differs by
105–108 through AVAssetImageGenerator. The crops show a saturated icon edge
blurred by that path; these are location evidence, not full-motion acceptance.

The [H.264 reader control](h264-reader.json) compares the first recorded window
through both Apple paths: all four pictures have exactly identical decoded RGBA.
The large H.264 discrepancies therefore remain encoding loss in that cohort,
not the ProRes-specific image-generator discrepancy.

The same ProRes files decoded through AVAssetReader requesting BGRA instead
stay within two RGB levels for all eight pictures, after the identical source-ICC
to-sRGB conversion. The reader’s propagated ICC hash matches the writer/reference
profile (`a1096ca47d80ba9df7f9f8fa87a0b9446d9b6a2c94ab11e4144495616b1eb29b`).
A separate FFmpeg decode of the first picture also stays
within two levels. [Reader measurements](reader.json) therefore implicate the
image-generator path in the large ProRes difference; they do not prove which
internal conversion it uses. Both Apple paths report alpha 254 for these opaque
encoded inputs; FFmpeg reports 255. No transparency-fidelity claim follows.

[ReaderPixels.swift](ReaderPixels.swift) captures the independent reader path:
compile with `swiftc -parse-as-library`, pass a movie and an existing empty output
directory, then use the parent writer probe's ICC conversion helper on the saved
BGRA files. It records actual presentation times and propagated attachments.
The native encoding settings remain those in the parent codec cohort's
`FrozenWriter.swift`, with 30 captured input frames for these windows.

ProRes movies are 13.9–19.9 MB for these mostly static one-second windows versus
71–100 KB for default H.264. Those sizes do not establish sustained resource use
or a general ratio. No production codec/default/profile changes are adopted.
A [public re-import check](public-reimport.json) imports the first-window ProRes
movie, places it in a new project and requests four full-size frames. Interior
pixels stay within two levels; the outer boundary differs by 12–14 because the
source path applies its sampling clamp. This is distinct from the corrected
finished-canvas PNG delivery and remains a source-boundary investigation.

Next compare actual playback and establish the required H.264 quality/size policy;
image-generator screenshots alone cannot decide encoder fidelity. The output
contract requires H.264/AAC, not an additional or lossless codec. ProRes remains
a diagnostic control rather than a new release dependency. Audio, general footage, duration/scale and motion
remain unverified by this probe.
