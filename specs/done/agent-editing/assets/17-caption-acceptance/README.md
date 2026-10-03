# Caption acceptance reconciliation

This closes the finite caption contract in parent 17, not the whole editor or
unverified audio features. Production caption code is unchanged in this pass.
The required 16 visual processing/anchor primitives are verified; remaining audio
transition, stretch and denoise gates stay with their own owners.

## Requirement coverage

| Requirement | Retained evidence |
| --- | --- |
| Explicit literal/style, wrapping, punctuation, long words, finite clipping, varied boxes | [Frozen17a parity and literal output](../17c-literal-text/README.md) |
| Immutable font bytes, explicit face, collections, same-name distinct assets, refusal | [Admission](../17b-font-admission/README.md) and [actual face rasters](../17c-literal-text/README.md) |
| Project/content/normalized anchors, split/trim/retime/repeat | [Literal public anchor journey](../17c-literal-text/anchors/report.json) and [seeded journey](../17d-transcript-seeding/README.md) |
| Explicit occurrence word pins, corrected display independent of source, exact replay/refusal | [Fresh seeded skill](../17d-transcript-seeding/fresh-skill/REPORT.md) |
| Font/source generation and acquisition dependencies through removal/history/relocation/undo | [Literal packages](../17c-literal-text/README.md) and [caption-only seeded packages](../17d-transcript-seeding/README.md) |
| Actual preview/export text and sampled encoded legibility | [Seeded movie reads and fresh critique](../17d-transcript-seeding/README.md) |
| Text over existing footage | Fresh critique and inspection below |
| Off-grid range phase and clipped caption boundaries | Delivered-clock check below |

## Footage visual gate

The previously retained public anchor PNGs use the frozen corpus `a.mov`, keeping
underlying geometry/animation fixed. The three sheets in `footage-visual` contain
16 full contexts and 16 crops; the original report file was mistakenly counted as
a seventeenth image in an initial coordination note. The manifest maps untouched
raw PNGs. Embedded profiles are transformed to explicit sRGB before compositing.

Fresh visual-only review found no definite defect: complete, readable captions,
consistent authored/split appearances, and expected visible differences among
retimed/repeated/trimmed samples. Crops truncate words because of framing, not
source clipping. Implementer and root inspected all three sheets and agree. The
critique does not establish intended timing, audio or continuous playback.

## Delivered-clock gate

The public `caption-clock` case of the existing captions harness uses two seconds
of frozen footage at 8 fps. One explicit caption ends at 505 ms; a second occupies
1000–1250 ms. A range preview requests 510–1510 ms. Its first visible interval must
retain the full project's 500 ms picture even though that caption has ended before
the requested preview start. The second caption tests later onset and half-open
removal; the final picture must end at the requested endpoint.

The harness reads actual movie PTS, imports full/range movies through public asset
admission and uses the Apple public frame reader at all nine corresponding samples.
It checks exact delivered interval ends from native rational sample receipts,
independent visible white caption presence/absence in the frozen top-of-frame
region, and bounded pixel differences between separately encoded full/range
pictures. Full preview and export bytes also match. These are delivered sample
checks, not a continuous-playback or audio synchronization claim.

Independent code review identified two insufficient initial assertions: parity
could hide shared omission, and timestamp starts did not establish the clipped
end. The independent visible-presence gate and exact native sample-end checks
address both. The [final matching harness run](clock/report.json.gz) passes all nine samples:
caption-region mean absolute error is at most 0.087/255; visible caption samples
contain 1460–1469 white pixels, and all six negative samples contain zero. The last
range sample ends at exactly 1,000,000 us local time after starting at 990,000 us.
Frozen worker SHA-256 is
`6663e0c169671fa8121ed26e9cf298fb0dd0d789fd5559954899af1e87b608b9`.

Fresh decoded-pair review inspected all nine A/B pairs across three `clock-visual`
sheets: 18 full contexts and 18 crops. It found no conspicuous differences in caption
presence, position, legibility or compositing. Full captions are readable and
complete in the three caption-bearing pairs; the other six pairs show no caption.
Confidence is high for presence/alignment and moderate for fine raster differences.
Implementer and root inspected the same sheets and agree, noting small encoded-edge
differences. Crops cut through text because of framing; that is not full-image
clipping. The review does not claim timestamps, intended timing, playback or audio.

The final independent read-only code/docs review confirms that visible-presence
and rational sample-end assertions address its earlier two findings, and that
retained reports support the numerical claims. It ran no native work or tests. Raw images in
`clock` remain untouched; verbose receipts and review logs are gzip-compressed.

## Explicit omissions

No continuous playback/listening, perceptual speech synchronization, ASR accuracy,
retimed-audio quality/readiness, universal font/script coverage, variation-axis
authoring, or font redistribution-rights inference is claimed. The selected-font
`.notdef` guard exists, but the public unsupported-character cases exercised actual
fallback rather than that distinct branch. Crop review does not cover every glyph
edge; finite requested clipping is preserved. These limits do not add new caption
requirements or hide their separate feature owners.

The larger `agent-editing` plan remains active; this is a slice acceptance record,
not an archive or whole-feature closure. Historical17a/b/c/d evidence is unchanged.
