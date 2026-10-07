# Matched picture comparison

Target: preserve the player's frame, complete oriented raster and sRGB appearance.
Variable: decoder/color interpretation. Mask: complete oriented raster; supplement
with face, wall/highlight and asymmetric-chart landmark inspection. No authored
look or geometry changes are under review.

All accepted sampled source/project rasters meet the frozen RGB mean-error and
maximum-delta bounds, with exact physical clocks. Camera mean errors are about
0.36–0.40 channel values out of255, maximum2; chart values are below0.30, maximum1.
Plain FFmpeg RGB differs about7–11 values on average. Its profile-aware PNG read
is a separate measured diagnostic and also differs; the actual profile identities
stay in the reports. Never judge that diagnostic with a stripped-profile montage.

Visible landmarks match across Player/Source/Project: camera head/shoulder
placement, wall and plant outlines, bright-window boundaries; chart red and green
corners and frame label orientation. All sides of each complete raster remain
present. Source warm light, backlighting and highlights are preserved; this is no
claim that those source choices are ideal. Comparison montages supplement retained
native-size pictures without becoming the color oracle.

The final profile assertion changed no image bytes:16 rotated PNGs are byte
identical to the prior captured set. Four source/project frames per case form the
numeric scope; selected representative originals are retained, while the complete
capture set was supplied to the fresh critic. Preview shows camera comparisons and
the rotation control for direction; viewing never becomes an acceptance gate.

Fresh unprimed critic inspected all25 retained shots and all80 PNGs in the complete
valid sample sets, using original-detail image views. It found no visible mismatch
in primary outputs: complete raster, expressions/content, chart labels/corners and
orientation match (high confidence); faces, walls, highlights, leaves and clothing
match in display appearance (moderate–high confidence). The FFmpeg diagnostic has
darker purple/blue fields and stronger red/green corners on the charts (high
confidence), consistent with the separate numerical diagnostic. Tiny channel
variations and unsampled playback remain outside this visual verdict. No visual
fix or editorial treatment is required. This was the last visual acceptance check.

Code review found missing enforced profile identity and absent evidence links.
Both are fixed. The scoped confirmation accepted the fixes and found a mixed-variable
profile test; independent one-variable refusal controls now pass with red falsification.
Parent shape/diff/docs review finds one observation owner, scoped sampling claims,
no production changes, and links from the harness and active spec to the evidence.
