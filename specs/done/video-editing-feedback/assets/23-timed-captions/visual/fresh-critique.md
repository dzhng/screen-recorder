# Fresh image-only caption review

No high-confidence layout, clipping, legibility, or entrance-phase defect is visible in the supplied candidate captures.

- **Minor color-edge observation — medium confidence, low severity.** Decoded movie letters have a slightly warmer orange fringe/tint on some yellow edges than the flatter yellow of the native stills. Visible in original movie frame-011.png (625000 us), frame-023.png (1375000 us), and the stable yellow `now` in frame-048.png. It is subtle at full-frame size and does not obscure letters or create colored streaks outside the caption. This is an appearance difference; the images alone do not establish its cause or whether exact color matching is required.
- **Historical baseline violates the entrance requirement — high confidence, baseline only.** entrance-0-baseline.png already displays the full caption, whereas entrance-0-candidate.png and entrance-0-reference.png are blank. The candidate's later entrance stills grow and brighten around the same caption center, reaching a full stable caption by 500000 us. The low contrast and softness at 62500 us are confined to the intentional entrance phase, not a persistent legibility failure.

Visible behavior supporting acceptance:

- Dark, uniform background throughout; complete readable `New  Trend! now`, including the wider gap after `New`, intact exclamation mark, and single-line layout. No characters crop, touch a frame boundary, collide, or jump when highlight colors change.
- Both `New` and `Trend!` are yellow together at 625000/687500 us; both `Trend!` and `now` are yellow together at 1375000/1437500 us. These overlaps are visible in native candidate/reference stills, the supplied 2x crops, and the movie sequence. Other highlight phases return the inactive words to white without leftover colored letters.
- Movie frame-001 is blank; subsequent frames progressively brighten and grow to the stable caption. The sequence repeats a blank entrance at frame-033 (2000000 us), then grows/fades in again. No visible clipping, off-center scaling, overshoot, positional wobble, or transient duplicate text appears.
- Split, repeated, and retimed examples retain the same readable geometry. Supplied crops show ordinary softened/antialiased letter boundaries; no doubled outlines, broken glyphs, or persistent halo is apparent.

Coverage and limits:

- Inspected all 52 native stills through capture-set-1.png through capture-set-5.png, all 48 chronological movie frames through movie-strip-1.png through movie-strip-4.png, and all six supplied 2x caption crops.
- Also inspected original entrance candidate stills at 62500, 187500, and 500000 us, and original movie frames 001, 011, 022, 032, 033, 034, and 048 to resolve details hidden by sheet presentation.
- Compared the supplied baseline, candidate, and reference views visually. No code, prior review, or implementation history was inspected.
- The movie sample spacing is 62500 us. These stills cannot prove continuous playback smoothness or defects between samples, and no audio was supplied. Interval declarations themselves were not supplied, so this review confirms the visible simultaneous highlighting at the pictured windows rather than independently validating every declared timestamp.
- The first exit is a full caption at 1937500 us followed by blank at 2000000 us. There is no supplied exit-fade requirement, so the visible hard removal is an observation, not a defect. The final provided frame is 2937500 us and still contains the caption; the terminal 3000000 us endpoint and any final exit are absent. Final-endpoint behavior remains unverified.
