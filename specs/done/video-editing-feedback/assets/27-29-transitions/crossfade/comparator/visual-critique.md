# Unprimed visual critique

A fresh explorer inspected every candidate and reference PNG in this receipt.
It found no spatial defect: all candidates are uniform, fully opaque 64×48
frames with no crop, edge artifact or unexpected transparency.

The explorer also reported a red/black versus blue/purple sequence mismatch,
but that comparison crossed transition families. The picture crossfade controls
are the `frame-*` pairs (blue → purple → blue); dip and flash controls are the
`dip-frame-*` and `flash-frame-*` pairs (red → black → red). The valid
same-family pairs are the ones used by `visual-parity-diff.json`: their sampled
pixels match exactly at every endpoint and pulse, with only the expected
crossfade midpoint encoding-rounding delta (`mae: 0.2848`). The cross-family
observation is therefore not an acceptance defect, and the unprimed spatial
inspection adds no repair request.
