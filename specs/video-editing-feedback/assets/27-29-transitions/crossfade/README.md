# Native picture transition delivery

`transition-delivery.mjs` drives the public CLI/MCP asset import and edit path
with deterministic solid-color sources. It applies one caller-authored crossfade
from 250ms through 750ms, then one dip and one flash pulse over the same window.
Each revision is read through `frame.get` outside and at the midpoint, and the
same revision is delivered through `preview.get`.

The native frame receipt shows the blue top layer outside the crossfade and both
explicit source channels at its midpoint (`[136, 0, 188]` mean RGB). Dip and flash
show the red source outside their windows (`[254, 0, 0]`) and the black canvas at
the midpoint (`[0, 0, 0]`); every preview contains all four declared project
frames. These are bounded picture receipts for public lowering and delivery.
The retained `crossfade.wav` and report also prove public native audio delivery: two full-range caller-authored sources are summed outside the window and follow opposing gain ramps through the 250–750ms window, with an independent PCM oracle at 100ms, 500ms and 900ms. Reference-conditioned visual acceptance and motion delivery remain separate gates.

The matched deterministic reference controls and native candidate frames were
also run through the repository screenshot comparator. The frozen receipt is in
[`comparator/transition/report/visual-parity-diff.json`](comparator/transition/report/visual-parity-diff.json),
with the nine reference PNGs under
[`comparator/transition/reference`](comparator/transition/reference). All nine
pairs have `parityDistance: 0`, zero pixelmatch and edge-difference ratios, and
zero mean luminance delta except the crossfade midpoint's expected
`mae: 0.2848` encoding-rounding difference. This is a fixed deterministic
parity receipt, not a substitute for the remaining moving-shot and
reference-conditioned gates.

The retained [unprimed critique](comparator/visual-critique.md) inspected every
candidate/reference PNG. It found all frames opaque and spatially clean. Its
cross-family color concern is documented and rejected because picture
crossfade and dip/flash have different declared controls. Within each valid
family, the comparator pairs match.

An unprimed visual critique inspected all six dip/flash frames: every frame is
opaque and fully filled, the red → black → red sequence is temporally consistent,
and no cropping, edge artifact or unexpected transparency was visible. The
comparator evidence and critique cover this deterministic control set; temporal
motion and real reference matching remain separate open gates.

The [`moving/`](moving/) receipt adds the retained asymmetric alpha and mirror
clips to the same public crossfade path. At 100ms, 500ms and 900ms the delivered
frames stay below the `0.98` black-pixel refusal threshold (`0.7402`, `0.8496`,
`0.7813`) and the midpoint mean RGB differs from the 100ms control, proving a
moving source reaches both sides of the transition without exposing an all-black
gap. The source hashes and native implementation identity are retained in
[`moving/report.json`](moving/report.json). These sparse alpha controls prove
coverage and source-clock delivery; they do not claim reference-conditioned
composition, color or trajectory parity.
