# Image-only review

A fresh image-only agent inspected the first complete three-shot window set:
before/after display the readable asymmetric source image; the gap is uniformly
black without meaningful residue. A separate image-only Codex review inspected all
six source/rendered comparison shots. Both before images show FRAME 0; both after
images show FRAME 1. Orientation and framing match, with no missing content or
visible gap residue. Confidence was high. Neither reviewer inferred timing from
still images.

The second review noted slightly lighter rendered backgrounds/green blocks,
darker red blocks and faint encoding halos. These are retained visible limitations;
this timing/orientation gate does not claim exact color equivalence. Source/before
also has a focused title-bar close button; window chrome is outside video content.
[Pixel metrics](window-pixel-metrics.json) retain the comparison region and actual
differences, including zero source-versus-rendered difference throughout the black
interior. All captured images are retained, including the initial exploratory set.

Own adversarial check: black could conceal a failed movie, but the full before and
after shots visibly contain distinct FRAME 0/1 images. Matching stills alone could
conceal timing errors; player-time brackets and independent decoded PTS/durations
are therefore separate required evidence. Color differences remain visible and
are not dismissed as pixel equality.

The final optional-command reproduction adds the complete three-shot
`window-reproduction/` set. It repeats the same source fixture and capture code,
with player-time brackets retained; it is not a new rendering variant.

The integration checkpoint opened source-before, rendered-before and rendered-gap
images together in Preview for a non-blocking review. No response arrived during
the review window; the images were closed. The integrating agent accepts the
measured timing/orientation and explicit black-gap mapping, while retaining the
visible color differences above as unresolved fidelity rather than pixel equality.
