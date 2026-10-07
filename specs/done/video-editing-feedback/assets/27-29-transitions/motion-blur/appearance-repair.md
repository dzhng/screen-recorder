# Motion-blur appearance repair

The original public/native receipt used a Core Image radius of `shutter × samples`.
On the retained moving red/blue alpha control that produced a visible footprint of
`x=12..47, y=5..31`, while the same authored trajectory without blur occupied
`x=18..42, y=5..31`. The broad horizontal expansion was the failure captured by
the first unprimed critique.

The native lowering now treats sample count as bounded work and derives a small
radius from the shutter interval alone. The public journey renders
both the blurred candidate and an unblurred copy of the same trajectory. The repaired
receipt records candidate bounds `x=17..43, y=5..31` against control bounds
`x=18..42, y=5..31`, zero transparent pixels, and 232 blur-changed pixels out of
3072 (the authored trajectory itself changes 329 pixels).
The regression failed with the old radius, then passed after the correction.

The fresh critique of the repaired frames found no displacement, clipping or
transparency defect. It identified the remaining one-pixel edge softness as the
bounded blur envelope; strict reference-conditioned parity is still a separate gate.
