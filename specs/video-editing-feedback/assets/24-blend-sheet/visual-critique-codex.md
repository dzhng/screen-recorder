**Still candidate (C vs arithmetic reference B)**

- **Normal row, row 1:** One 16×16 source block differs in green by +1 (`163,57,155` → `163,58,155`), located at source block 4 across × 2 down. **Confidence: high.** Only evident on pixel enlargement; not visually apparent at the supplied 4× sheet size.
- **Multiply row, row 2:** No visible or pixel-level difference found. Boundaries, colors, layering, and alpha match. **Confidence: high.**
- **Screen row, row 3:** No difference found. **Confidence: high.**
- **Soft-light row, row 4:** One 16×16 source block differs in blue by +1 (`212,135,83` → `212,135,84`), top band, block 5 across. **Confidence: high.** Enlargement-only.
- **Reversed source/backdrop soft-light row, row 5:** No difference found. **Confidence: high.**
- **Nested-group multiply row, row 6:** No difference found. **Confidence: high.**
- **Smooth vignette row, row 7:** Sparse ±1-channel rounding differences occur across the gradient. The vignette center, extent, and falloff position remain aligned; no clipping or blur-shape change is visible. **Confidence: medium-high.** Enlargement-only.

All inspected still rasters are fully opaque; no alpha discrepancy was visible.

**Still verdict:** Very close, but not pixel-identical. Rows 2, 3, 5, and 6 match B; rows 1, 4, and 7 contain minor rounding differences.

**Decoded movie candidate (D vs B; applies identically to both movie samples)**

- **Rows 1–6:** Sharp patch boundaries are contaminated by one source-pixel-wide mixed-color seams, equivalent to roughly 4 pixels in the supplied 4× sheet. This occurs at repeated vertical and horizontal boundaries, including color-to-color, color-to-black, and white-to-black transitions. Examples include mixed columns around source x=15, 31, 47, 63, 79, 95, 111 and mixed rows around y=15, 31, 47. **Confidence: high.** Visible at the supplied native sheet size and obvious on enlargement.
- **Rows 1–6:** Tile interiors also have systematic RGB drift: whites become about 253, grays about 127, blue/orange/magenta blocks shift by roughly 1–2 levels. **Confidence: high.** Subtle at native size; clear on enlargement.
- **Rows 1–6:** Block alignment and outer extents remain in the correct positions. I found no whole-image translation, clipping, missing layer, or alpha change. **Confidence: high.**
- **Row 7:** No hard-edge seam issue, but the vignette is broadly shifted by small channel amounts, generally slightly darker/lower-luma by about 1–4 levels. The gradient footprint and center remain aligned; no clear falloff displacement. **Confidence: medium-high.** Mostly enlargement-visible.

**Movie verdict:** Fails the target comparison because of repeated visible edge blending/halo seams and pervasive color drift, despite correct alignment and opacity.