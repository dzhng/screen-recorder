I inspected all 29 PNGs (14 at top level, 15 under `source/`). Report below.

---

# Visual critique — /tmp/screenrec-cursor-integrated-run

## Limitation encountered (stated as required)

**I could not produce enlarged crops.** Bash was denied under the current permission mode after the initial directory listing, so I could not run `sips`/`magick` to write crops into `/tmp/screenrec-cursor-visual-review` (the scratch directory was never created — that `mkdir` was the first denied call). I also could not read pixel dimensions. Every finding below therefore comes from full-frame inspection at the viewer's rendered resolution, plus the five `calibration-*-cursor.png` files, which are small enough that the Read tool displays them at effectively native/enlarged scale. Where the missing magnification limits my certainty, I say so in the confidence rating. No connector/authorization issue was involved.

## Images actually inspected (all 29)

Top level: `frame-0-start.png`, `frame-1-moved.png`, `frame-2-resized.png`, `frame-3-otherDisplay.png`, `frame-4-underPointer.png`, `overlay-0-start.png`, `overlay-1-moved.png`, `overlay-2-resized.png`, `overlay-3-otherDisplay.png`, `overlay-4-underPointer.png`, `pointer-3-otherDisplay.png`, `pointer-4-underPointer.png`, `recorded-3-otherDisplay.png`, `recorded-4-underPointer.png`.

`source/`: `calibration-0-clean.png`, `calibration-0-cursor.png`, `calibration-0-pointer.png`, `calibration-1-clean.png`, `calibration-1-cursor.png`, `calibration-1-pointer.png`, `calibration-2-clean.png`, `calibration-2-cursor.png`, `calibration-2-pointer.png`, `calibration-3-clean.png`, `calibration-3-cursor.png`, `calibration-3-pointer.png`, `calibration-4-clean.png`, `calibration-4-cursor.png`, `calibration-4-pointer.png`.

Not opened (excluded by your instructions): `report.json`, `probe.json`, `source/capture.json`, `source/cursor-geometry.json`, `source/capture.journal.jsonl`, `source/video.mov`.

---

## Findings

### 1. Pointer entirely absent from three "-pointer" source captures — **high confidence**

`source/calibration-0-pointer.png`, `source/calibration-1-pointer.png`, `source/calibration-2-pointer.png` contain **no cursor anywhere in frame**. Each is visually indistinguishable from its `-clean` sibling, and the file sizes are byte-for-byte equal (357 853 / 342 756 / 1 090 763 respectively), which corroborates that they are the same image.

This is not a subtle miss: `source/calibration-0-cursor.png`, `-1-cursor.png`, `-2-cursor.png` each contain an open-hand cursor bitmap, so a cursor *was* recorded as present for those three steps, yet it appears nowhere in the paired full frame. By contrast `calibration-3-pointer.png` and `calibration-4-pointer.png` do show a real arrow cursor (C3 at ≈(1440, 843); B2 right edge at ≈(820, 516)). This is the cleanest defect in the set, and it explains the missing `pointer-0/1/2-*.png` outputs.

### 2. Recorded frames contain no pointer while the matching source frame does — **high confidence on the observation, medium on whether it is a defect**

`recorded-3-otherDisplay.png` and `recorded-4-underPointer.png` show zero cursor pixels. The corresponding `source/calibration-3-pointer.png` and `source/calibration-4-pointer.png` — same window state, same grid, same markers — clearly show the system arrow at C3 and at the B2/B3 gutter. The `pointer-3-*.png` / `pointer-4-*.png` images show a cursor at those same coordinates, but it is drawn with an annotation box and label, i.e. plausibly composited by the harness rather than captured.

So either the recording genuinely drops the pointer, or "recorded" is intentionally the cursor-free variant of the pair. I cannot distinguish these without reading implementation or reports, which you excluded. Flagging as the highest-value item to confirm.

### 3. Bottom row clipped in the step-0 frames — **high confidence (real clipping, not a letterbox)**

In `frame-0-start.png`, `overlay-0-start.png`, `source/calibration-0-clean.png` and `source/calibration-0-pointer.png`, the C1/C2/C3 cells run off the bottom edge of the image: their bottom borders are never visible and marker 5 in C1 sits roughly 20 px above the cut. Marker 4 in C3 is only ~110 px above the cut.

This is distinct from the black band discussed in item 4. There is no band here — coloured cell content is truncated mid-cell by the image boundary, so content is genuinely lost.

### 4. Black bottom band in steps 2/3/4 — **intentional letterbox, not a defect**

`frame-2-resized.png`, `frame-3-otherDisplay.png`, `frame-4-underPointer.png`, `pointer-3-otherDisplay.png`, `pointer-4-underPointer.png`, `recorded-3-otherDisplay.png`, `recorded-4-underPointer.png`, `overlay-2-resized.png`, `overlay-3-otherDisplay.png`, `overlay-4-underPointer.png`, and `source/calibration-2/3/4-{clean,pointer}.png` all carry a uniform black band of roughly 45–70 px across the full width at the bottom. In every one of these the complete grid *including* the C-row bottom borders is visible above the band. That is letterboxing of a shorter content rect into a taller output frame — an intentional crop/pad boundary, and I am calling it clean. `frame-1-moved.png` / `overlay-1-moved.png` have neither band nor clipping: full grid plus white margin.

### 5. Step-0 frames rendered at a visibly larger content scale than steps 1–4 — **medium confidence (cannot measure pixel dimensions)**

At equal display width, `frame-0-start.png` renders the fixture about 5–6 % larger than `frame-1-moved.png`: the title bar is taller (≈62 px vs ≈50 px), the B2 marker sits at y ≈ 646 vs ≈ 610, and the C1 marker at y ≈ 1060 vs ≈ 996. Same relationship for `overlay-0-start.png` vs `overlay-1-moved.png` and `source/calibration-0-*` vs `-1-*`.

That scale jump is what produces the item-3 clipping. It is worth attention because it occurs between **start** and **moved** — a step named as a translation, not a resize — while the step actually named `resized` (index 2) shows no further scale change relative to index 1. Confidence is capped at medium because the images may simply have different native pixel dimensions and the viewer normalised them; I could not read dimensions with Bash denied.

### 6. Heavy high-frequency noise and desaturation in the step-2 captures — **high confidence**

`source/calibration-2-clean.png` and `source/calibration-2-pointer.png` show a fine diagonal streak/crosshatch texture across every flat colour fill, most obvious in the B2 magenta and A2 green regions. The same mottling is present, more faintly, in `frame-2-resized.png`. Corroborating signal: these two files are 1 090 763 bytes versus 357 853 and 342 756 for the step-0/1 equivalents — roughly 3× the PNG size for identical flat-colour content, which is what dense pixel noise does to PNG.

Separately, the step-2 images are noticeably washed out relative to step 3/4. Compare A3 blue and A1 pink across `frame-2-resized.png` → `frame-3-otherDisplay.png` / `frame-4-underPointer.png`, and `source/calibration-2-clean.png` → `source/calibration-3-clean.png`: the step-3/4 versions are distinctly more saturated. Consistent across clean and pointer variants of step 2.

### 7. Cursor asset scale is wildly inconsistent between steps — **high confidence**

`source/calibration-0-cursor.png`, `-1-cursor.png`, `-2-cursor.png` (352 bytes each, identical) render as a tiny open-hand glyph, on the order of a couple dozen pixels square. `source/calibration-3-cursor.png` and `-4-cursor.png` (13 475 bytes each, identical) render as a large, crisp arrow on a canvas several hundred pixels on a side. Two different cursor shapes across one run is plausible; an order-of-magnitude difference in asset dimensions within the same run is not obviously so.

### 8. Hand-cursor assets are near-invisible / effectively unreadable — **high confidence**

The glyph in `source/calibration-0-cursor.png`, `-1-cursor.png`, `-2-cursor.png` is a thin light-grey outline with no dark fill. At its native size it is barely discernible and would be essentially invisible composited onto any light background — which is exactly what the fixture's white gutters and pale cells are. Contrast this with the arrow in `-3-cursor.png` / `-4-cursor.png`, which is solid black with a white halo and reads clearly.

### 9. Large empty padding in the arrow cursor assets — **medium confidence**

In `source/calibration-3-cursor.png` and `source/calibration-4-cursor.png` the arrow occupies only the upper-left third of the canvas; the entire right side and bottom two-thirds are empty. If that canvas is meant to represent the cursor image bounds, the bounds are substantially oversized relative to the drawn glyph. macOS cursor images do carry some padding, so I am not calling this a defect outright — but the ratio here is large enough to be worth a look.

### 10. Overlay digit "3" appears mirrored — **low-to-medium confidence (this is the finding most hurt by the missing crops)**

In `overlay-0-start.png`, `overlay-1-moved.png`, `overlay-2-resized.png`, `overlay-3-otherDisplay.png` and `overlay-4-underPointer.png`, the cyan index label beside the B2 marker reads as "Ǝ" — the open side facing left — rather than "3". It is consistent across all five overlays and independent of which side of the box the label sits on. Digits 1, 2, 4 and 5 in the same overlays, and the orange "4"/"5" in `pointer-3-otherDisplay.png` / `pointer-4-underPointer.png`, all read correctly. A single mirrored glyph in an otherwise-correct set points at the label renderer, but at the resolution available to me I cannot rule out that this is a squared-off stylised 3.

### 11. Marker placement and numbering: clean — **no defect found**

Across all five overlays the assignment is stable: 1 → A1 top-left, 2 → A3 top-right, 3 → B2 centre, 4 → C3 bottom-right, 5 → C1 bottom-left. Every cyan box is centred on its black measurement square, with no drift I can detect between `overlay-0-start.png` and `overlay-4-underPointer.png`. The black squares themselves land at the same relative position within their cells in every corresponding `frame-*.png`. **No marker displacement detected.**

The label side-flip is intentional, not a defect: marker 4's digit sits to the *right* of its box in `overlay-0-start.png` but to the *left* in `overlay-1-moved.png` through `overlay-4-underPointer.png`, and marker 2's digit flips the same way — standard edge-avoidance so the label never leaves the frame.

### 12. Pointer positional accuracy: good — **no defect found**

Cross-checking the annotated pointer images against their ground-truth source captures:

- `pointer-4-underPointer.png` — locator box spans roughly x 800–840, y 500–535 (centre ≈ (820, 518)); the cursor tip in `source/calibration-4-pointer.png` is at ≈ (820, 516). Agreement within a few pixels.
- `pointer-3-otherDisplay.png` — box spans roughly x 1417–1457, y 820–857 (centre ≈ (1437, 839)); the cursor tip in `source/calibration-3-pointer.png` is at ≈ (1440, 843). Tip sits ~4–5 px below and ~3 px right of box centre — comfortably inside the box, and small enough to be render-scaling noise at my inspection resolution. Worth noting only as a minor asymmetry versus the near-perfect step-4 case.

In both, the arrow's lower tail extends a few pixels past the box's bottom edge. Since this happens identically in both images, the box is sized to the hotspot region rather than the glyph bounds — intentional, not clipping.

### 13. Pointer residue: none — **high confidence**

No ghosting, duplicate cursors, or stale pointer imagery anywhere. `pointer-4-underPointer.png` contains exactly one cursor, in B2, with nothing left behind at the step-3 location in C3. `pointer-3-otherDisplay.png` likewise shows a single cursor. No dark matte fringe or halo artifact around either composited arrow — the white cursor outline reads cleanly against both the beige C3 and magenta B2 backgrounds. `recorded-3-otherDisplay.png` and `recorded-4-underPointer.png` contain no cursor pixels at all (see item 2), so no residue there by construction.

### 14. Minor: right-margin asymmetry in steps 2/3/4 — **low confidence**

In `frame-0-start.png` and `frame-1-moved.png` the white margin left of A1/B1/C1 and right of A3/B3/C3 look symmetric (~8–10 px each). In `frame-2-resized.png`, `frame-3-otherDisplay.png`, `frame-4-underPointer.png` and the step-2/3/4 calibration frames, the right margin is reduced to ~2 px while the left stays at ~6 px, i.e. the right column runs almost to the image edge. A few pixels of the right margin may be cropped. This is at the limit of what I can judge without magnification and could easily be rounding in the capture rect.

### 15. Label legibility elsewhere: acceptable — **no defect found**

All nine cell labels (A1…C3) are crisp, high-contrast black, and fully readable in every frame, overlay, pointer and calibration image — including the noisy step-2 pair. The title text "Screen Recorder Capture Fixture" is light grey on white in all images, so contrast is low by design, but it remains legible everywhere; it is rendered smaller and slightly softer in the step-2/3/4 frames than in step 0/1, consistent with the item-5 scale difference. No truncated or overlapping text anywhere.

---

## Priority

1. **Item 1** — pointer missing from `calibration-0/1/2-pointer.png` (deterministic, three of five steps, confirmed by identical file sizes).
2. **Item 2** — pointer missing from both `recorded-*.png` while present in the matching source frame.
3. **Item 3 + 5** — step-0 content clipped at the bottom, driven by a scale difference that appears at the "moved" step.
4. **Item 6** — noise and desaturation localised to the step-2 captures.
5. **Items 7/8/9** — cursor asset scale, contrast, and padding inconsistencies.
6. **Item 10** — mirrored "3"; cheap to confirm but needs a crop I could not produce.

If you re-run with Bash permitted, items 5, 10 and 14 are the three I would expect to firm up or drop once I can measure dimensions and magnify the label and margin regions.
