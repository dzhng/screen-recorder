# Composition PNG color-path localization

The retained 23l composition differences already exist in the published PNG sample
values. The existing 21e color-managed display oracle changed none of the selected
RGB(A) values. This read-only supplement localizes the difference to the producer
path, without establishing its precise cause, proposing a tolerance or changing
acceptance. Original source, images, normalized outputs and native worker remain
unchanged.

[Results](results.json) compare nine distinct content pairs covering all fourteen
composition receipts in the immutable `/tmp/screenrec-23l-packet`. Each original
PNG hash is checked against the complete executing report before lossless zlib
inflation and PNG scanline reconstruction. RGB receives an opaque alpha channel
solely for the byte comparison; no color conversion, resize or image generation
runs. All eighteen pair inputs equal their already saved sRGB RGBA bytes exactly.
Encoded pair differences therefore equal the normalized differences in every
channel. Composition PNGs are 8-bit RGBA; direct/legacy PNGs are 8-bit RGB. Both
carry the identical PNG sRGB intent byte. Their recorded display profile is the
same sRGB ICC, and every alpha sample is opaque.

The changes are ±1 in RGB, with no alpha or outer-canvas-border differences.
Interior changes span the image. Identical normalized reference RGB tuples can
produce different composition tuples, so a deterministic correction lookup over
those public RGB values is not established. These facts exclude a normalization-only
explanation and a change confined to the canvas border. They do not prove decoder
buffer equality, a particular rounding rule or the absence of an interior graph
precision effect.

The exact source and runtime references are in
[artifact-references.json](artifact-references.json) and [verification.json](verification.json).
The eight materialized native sources match the frozen 09c source authority and
current selected source bytes. The observed worker is the unchanged `0a9cd72a…6928`;
the pixel oracle is `f70abec3…af4`. Both current paths use PresentationSource's BGRA
reader and the same orientation helper. The actual saved composition requests have
one full-size source layer, identity affines, a full-canvas coverage mask, no
processing/pointers and no delivery resize. Exact sample identities, dimensions
and delivered bytes remain owned by the full 23l packet.

The composition route adds an extended-linear-sRGB half-float graph, renders into
an 8-bit BGRA buffer tagged Rec.709, then feeds that buffer into the common
FrameImage PNG publication. Direct source inspection feeds the oriented source
image directly into that publication with a context lacking those explicit graph
options. PNG publication is `FrameImage.png`/`encodePNG` in the frozen source;
there is no separate FrameImagePNG symbol. The extra graph/context/buffer stages
are concrete source differences, but none is yet the demonstrated cause.

The saved packet has no original decoded buffer bytes/color attachments, graph
intermediate values, intermediate Rec.709 buffer samples or pre-encode CGImage
samples. Terminal PNG and profile receipts cannot distinguish those stages. A
PNG/profile-label change or an oracle replacement is therefore unjustified.

The smallest next gate is an isolated, separately authorized **image-only stage
comparison** using one retained source PNG as fixed input. Compare direct
publication, the unchanged compiled identity graph published directly, and the
same graph through the existing Rec.709 BGRA terminal step. Capture complete sample
values and actual color-space/format metadata at each boundary, retaining exact
comparisons and the untouched input. This introduces no movie decode, ASR, new
recording or repeated public producer cohort. A failure would identify which
stage changes that valid image input; it would not retroactively prove the
historical decoder-buffer cause.

If only the terminal buffer variant changes pixels, the next implementation seam
is the still-picture publication boundary: preserve one compiled graph owner and
separate still PNG publication from the movie buffer target. If the direct graph
variant already changes pixels, that correction would be insufficient; diagnose
its context/primitive boundary first. Do not add an identity-only raw bypass or a
lookup correction. Historical causal attribution would additionally need one
qualified source sample's missing intermediate evidence. No such diagnostic or
production change is executed or authorized by this supplement.

The [audit source](audit.mjs) is a fixed-fixture byte inspection script, not a
product decoder or acceptance policy. Scoped syntax/lint/format, exact source/input
pins and packet integrity passed. [Choices](choices.md) record the limited
inspection method and rejected explanations. The original full packet remains
immutable; shared plan/hub integration belongs to root.
