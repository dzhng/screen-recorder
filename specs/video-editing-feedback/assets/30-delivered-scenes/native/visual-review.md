# Native delivered-scene visual review

Target: the delivered fixture must show a readable white flash, a stable dark
interval, a stable hold color, and a final dark transition at the recorded
scene times; no frame may be clipped or empty outside the authored colors.

Retained frames: `frame-01` (black), `frame-06` (flash white), `frame-10`
(black gap interval), `frame-14` (hold gray), and `frame-20` (hold-end dark).

Fresh inspection of all five frames found the expected full-raster colors,
consistent 256×192 framing, and no clipping, tearing or decode artifacts. The
strongest contrary case is that the flat-color fixture could hide a spatial
crop defect; all pixels occupy the expected full raster and the native scene
rows provide exact transition clocks, so no such defect is visible here.

The compare-screenshots helper was attempted but could not load its optional
`pngjs` dependency in this checkout. No reference pair exists for this
fixture; the report therefore relies on exact native scene clocks, source-byte
hash preservation, and direct frame inspection.
