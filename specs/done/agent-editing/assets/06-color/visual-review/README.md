# Native appearance review

Target: preserve source appearance, orientation and readable text at the same
geometry through color conversion. Encoding quality is judged separately; a
cleaner but differently colored image is not an appearance-preserving conversion.

The fresh [critique](critique.md) received all twenty full images and twenty
three-times-nearest-neighbor crops, in neutral groups. The [mapping](mapping.json)
identifies the exact source files and crop rectangles; full images remain in the
frozen evidence rather than duplicated here. The reviewer received no code,
expected answer, source/candidate labels or prior findings.

Disposition: accept the demonstrated source-to-pre-encode conversion only. The
reviewer finds a/b visually tied, consistent with the all-pixel maximum error of
zero for synthetic sources and one for the recorded frame. Geometry and the
quarter-turn orientation remain stable. Variant d looks different for untagged
sources; its cleaner-looking synthetic edges do not justify replacing the source
profile with an unsupported assumption.

Encoding remains a distinct open quality decision. The 4 Mbps recorded variant
has visible halos and smearing around text and grid lines. The 40 Mbps variant is
substantially cleaner, with subtler remaining differences. Parent inspection of
the full source and recorded text crops agrees. No universal bitrate or Rec.709
production profile is selected by this single-frame comparison. Whole-image
four-level error remains red for lossy outputs; no threshold was relaxed.

Crop boundaries cut some synthetic glyphs and the browser viewport truncates
lower cards in every variant. These are shared framing limits, not conversion
clipping. The review says nothing about motion, HDR, other camera sources, audio,
voice quality or longer scenes.
