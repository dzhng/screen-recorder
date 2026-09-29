# Neutral final visual critique

Verdict: the supplied matched-source variants preserve visible page geometry, content, text and browser landmarks. The encoded/export/presentation variants remain readable. There are visible cursor-presence differences, small tonal differences, and one same-request vertical page offset; those must not be collapsed into an assertion that every variant is visually identical.

This is a fresh image-only inspection of the supplied manifest and its images. Every full image and every detail crop was displayed individually through view_image, grouped by matching requested time. No project code, earlier report, or other image set was consulted. Full 3120 × 1970 images were displayed by the tool at 1976 × 1248; the provided detail crops retained substantially closer text/icon inspection. No image was modified. Conclusions are visual, not pixel-equality or global color-fidelity claims.

## Opening

- Image-01 / Image-04 (1,000,000 us), Image-03 / Image-06 (5,000,000 us), and Image-02 / Image-05 (10,000,000 us): no discernible pairwise content, geometry, cursor or color change. All show the initial grid and token SQQKAS. The five colored landmarks occupy the same positions. Confidence high for gross geometry/content, medium for tiny raster differences.
- These six images are much smaller than subsequent groups. Headings, badge codes and token are readable; tiny browser icons, helper copy and badge subtitles are soft/pixelated in the supplied small crops. This affects both variants similarly, so it is not evidence of a variant-specific regression. Confidence high.
- No cursor is visible in these six full images or their detail-1 areas. Confidence high in the inspected images.

## Same-request temporal comparison

- Image-07 / Image-10 at 1,000,000 us show the same initial grid, token SQQKAS, browser location 127.0.0.1:4318, and top scroll position. No visible cursor. No discernible geometry/readability difference. Confidence high.
- Image-09 / Image-12 at 67,000,000 us show the same three readable sections: The first paragraph, A sentence to identify, and A moment to pause. Image-12 page content is slightly lower than Image-09 (roughly six pixels at the displayed full-image size); the horizontal separators, headings and paragraphs all move together while browser chrome remains fixed. Detail-3 and detail-4 make the offset clear; the top of section number 02 enters Image-12-detail-4 while it is outside Image-09-detail-4. The text itself and its line wrapping are preserved. This is a same-request state/scroll-position difference, not evidence of a matched-source scaling defect. No visible cursor in either. Confidence high for the offset; exact source-time cause cannot be inferred from stills.
- Image-08 / Image-11 at 134,000,000 us show the returned grid, token V4HETB and location suffix /#grid-title. No visible cursor or discernible pairwise geometry difference. Confidence high.

## Matched-source geometry and readability

- Image-13 / Image-16 / Image-19 at 1,000,000 us preserve the same initial page: SQQKAS, all five landmark badges, regular grid lines, card bounds, header and browser controls.
- Image-15 / Image-18 / Image-21 at 67,000,000 us preserve the same section positions, separators, line wrapping, heading forms and body text, including the bold phrase “this is free.” The small same-request offset above is not visible within this matched-source trio.
- Image-14 / Image-17 / Image-20 at 134,000,000 us preserve the returned grid, V4HETB, /#grid-title location, card alignment and badge placement.
- Across all three trios I see no lost badge, distorted grid, shifted browser chrome, clipping introduced in one variant, added blur, broken icon or missing text. Browser location, reload/back symbols and supplied top-strip icons are distinguishable; headline and body letterforms remain readable in the detail crops. No cursor is visible in any of these nine full images or detail-1 crops. Confidence high for geometry/content/readability; medium for the absence of very subtle raster/color variation.

## Independently encoded exports

- Image-22 versus Image-25 at 1,000,000 us: both retain the initial SQQKAS page and equivalent framing. Image-22 has a single white arrow with black outline in the blank right margin beside the upper grid area (about 93% across, 38% down); Image-25 has no visible cursor. Image-22-detail-1 confirms the clean arrow shape, with no rectangular background, doubled cursor or trail. Confidence high.
- Image-24 versus Image-27 at 67,000,000 us: both retain the same readable three-section content. Image-27 content is slightly lower, like the same-request pair, while browser chrome is stable. Image-24 has a single outlined white arrow in the blank area near the right end of the first section, above its bottom divider (about 71% across, 39% down); Image-27 has none. Confidence high.
- Image-23 versus Image-26 at 134,000,000 us: both retain V4HETB and /#grid-title with equivalent geometry; neither has a visible cursor. Confidence high.
- Image-25 / Image-26 / Image-27 look slightly warmer/darker in their pale page backgrounds than Image-22 / Image-23 / Image-24. The colored grid badges in Image-25 and Image-26 also look somewhat deeper in tone. These are small visible presentation differences; no supplied reference establishes which is more color-faithful. Confidence medium.
- Both export variants preserve useful text/icon readability. There is mild fine-edge softness/raster roughness at close crop scale, without conspicuous block corruption, ringing that obscures letters, horizontal tearing, stretched text or lost landmarks. Confidence high for readable content, medium for fine artifact equivalence. Independent encodes are not expected to prove pixel identity.

## Presentation routes

- At 1,000,000 us Image-28 / Image-31 / Image-34 / Image-37 preserve identical visible source content and framing, including SQQKAS and the five landmarks. Image-28, Image-31 and Image-34 each show one white, black-outlined arrow at the same right-margin location. Image-37 does not. Each supplied detail-1 confirms that presence/absence. Confidence high.
- At 67,000,000 us Image-30 / Image-33 / Image-36 / Image-39 preserve the three-section layout and readable text at matching positions. Image-30, Image-33 and Image-36 show one outlined white arrow near the right end of the first section, above the divider; Image-39 does not. The arrow size, appearance and placement are visibly consistent across the first three. Confidence high.
- At 134,000,000 us Image-29 / Image-32 / Image-35 / Image-38 preserve the returned grid, token V4HETB, /#grid-title and framing; none shows a visible cursor. Confidence high.
- Image-31 / Image-32 / Image-33 look subtly lighter in the pale background than the corresponding other routes, particularly Image-34 / Image-35 / Image-36 and Image-37 / Image-38 / Image-39. Browser and page lettering remain readable throughout. No route exhibits a gross scale, aspect, cropping, geometry, or text-integrity failure. Confidence medium for subtle tone differences, high for geometry/content.

## Clipping and limits

The full images retain the browser bar, page side margins, and all five grid landmarks whenever the grid is shown. The lower two cards continue beyond the bottom of the viewport in the grid views, consistently across variants. This is visible viewport framing rather than evidence that a full-page document was promised. The provided detail crops intentionally cut off long headings/body lines at left/right edges, the far-right tab icon, and small slivers of neighboring landmarks/section numbers. Those crop boundaries must not be reported as full-image clipping: the corresponding full images show the relevant complete text and landmarks. The pale/blank detail-1 crops are valid observed areas, not failed full frames.

These stills do not establish playback smoothness, transient flicker between samples, physical capture provenance, sub-frame timing, or exact color correctness. Cursor absence is reported as a visible difference without assuming it is intentional or defective.

## Complete inspection coverage

39/39 full images and 156/156 detail crops inspected, 195/195 image files total. In the table, D1–D4 means the exact four manifest paths Image-NN-detail-1.png through Image-NN-detail-4.png, each opened and visually inspected, not inferred from another variant.

| Neutral image label | Group | Requested time (us) | Full | Detail crops |
|---|---|---:|---|---|
| Image-01 | opening / Variant-1 | 1000000 | inspected | D1, D2, D3, D4 inspected |
| Image-02 | opening / Variant-1 | 10000000 | inspected | D1, D2, D3, D4 inspected |
| Image-03 | opening / Variant-1 | 5000000 | inspected | D1, D2, D3, D4 inspected |
| Image-04 | opening / Variant-2 | 1000000 | inspected | D1, D2, D3, D4 inspected |
| Image-05 | opening / Variant-2 | 10000000 | inspected | D1, D2, D3, D4 inspected |
| Image-06 | opening / Variant-2 | 5000000 | inspected | D1, D2, D3, D4 inspected |
| Image-07 | same-request / Variant-1 | 1000000 | inspected | D1, D2, D3, D4 inspected |
| Image-08 | same-request / Variant-1 | 134000000 | inspected | D1, D2, D3, D4 inspected |
| Image-09 | same-request / Variant-1 | 67000000 | inspected | D1, D2, D3, D4 inspected |
| Image-10 | same-request / Variant-2 | 1000000 | inspected | D1, D2, D3, D4 inspected |
| Image-11 | same-request / Variant-2 | 134000000 | inspected | D1, D2, D3, D4 inspected |
| Image-12 | same-request / Variant-2 | 67000000 | inspected | D1, D2, D3, D4 inspected |
| Image-13 | matched-source / Variant-1 | 1000000 | inspected | D1, D2, D3, D4 inspected |
| Image-14 | matched-source / Variant-1 | 134000000 | inspected | D1, D2, D3, D4 inspected |
| Image-15 | matched-source / Variant-1 | 67000000 | inspected | D1, D2, D3, D4 inspected |
| Image-16 | matched-source / Variant-2 | 1000000 | inspected | D1, D2, D3, D4 inspected |
| Image-17 | matched-source / Variant-2 | 134000000 | inspected | D1, D2, D3, D4 inspected |
| Image-18 | matched-source / Variant-2 | 67000000 | inspected | D1, D2, D3, D4 inspected |
| Image-19 | matched-source / Variant-3 | 1000000 | inspected | D1, D2, D3, D4 inspected |
| Image-20 | matched-source / Variant-3 | 134000000 | inspected | D1, D2, D3, D4 inspected |
| Image-21 | matched-source / Variant-3 | 67000000 | inspected | D1, D2, D3, D4 inspected |
| Image-22 | exports / Variant-1 | 1000000 | inspected | D1, D2, D3, D4 inspected |
| Image-23 | exports / Variant-1 | 134000000 | inspected | D1, D2, D3, D4 inspected |
| Image-24 | exports / Variant-1 | 67000000 | inspected | D1, D2, D3, D4 inspected |
| Image-25 | exports / Variant-2 | 1000000 | inspected | D1, D2, D3, D4 inspected |
| Image-26 | exports / Variant-2 | 134000000 | inspected | D1, D2, D3, D4 inspected |
| Image-27 | exports / Variant-2 | 67000000 | inspected | D1, D2, D3, D4 inspected |
| Image-28 | presentation / Variant-1 | 1000000 | inspected | D1, D2, D3, D4 inspected |
| Image-29 | presentation / Variant-1 | 134000000 | inspected | D1, D2, D3, D4 inspected |
| Image-30 | presentation / Variant-1 | 67000000 | inspected | D1, D2, D3, D4 inspected |
| Image-31 | presentation / Variant-2 | 1000000 | inspected | D1, D2, D3, D4 inspected |
| Image-32 | presentation / Variant-2 | 134000000 | inspected | D1, D2, D3, D4 inspected |
| Image-33 | presentation / Variant-2 | 67000000 | inspected | D1, D2, D3, D4 inspected |
| Image-34 | presentation / Variant-3 | 1000000 | inspected | D1, D2, D3, D4 inspected |
| Image-35 | presentation / Variant-3 | 134000000 | inspected | D1, D2, D3, D4 inspected |
| Image-36 | presentation / Variant-3 | 67000000 | inspected | D1, D2, D3, D4 inspected |
| Image-37 | presentation / Variant-4 | 1000000 | inspected | D1, D2, D3, D4 inspected |
| Image-38 | presentation / Variant-4 | 134000000 | inspected | D1, D2, D3, D4 inspected |
| Image-39 | presentation / Variant-4 | 67000000 | inspected | D1, D2, D3, D4 inspected |
