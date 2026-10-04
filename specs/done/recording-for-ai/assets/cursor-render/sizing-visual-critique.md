I read all 47 files (19 full images, 28 4x crops). Findings below, ordered by severity.

---

## 1. Pointer is dropped entirely in `overlay-scaled.png` — **high confidence**

**Where:** full image + `overlay-scaled-4x.png` crop (both).

`overlay-trail.png` (320px) renders a trail ending in an arrow at ~x=270, in the gap between the trail end and the blue square. `overlay-scaled.png` is the same frame, same trail extent (0.46→0.85 of width), **but no arrow is drawn at all**. At 4x upscale the terminus is empty background — this is not a "too small to see" case, the glyph is absent. The trail survives the downscale; the cursor does not.

This is the single most damaging defect: the scaled variant is the one that would go to a model, and it shows motion evidence with no actor.

## 2. Trail disintegrates into a dotted line when scaled — **high confidence**

**Where:** `overlay-scaled-4x.png` crop (visible but ambiguous in the full image).

The trail in `overlay-scaled-4x` is a broken row of ~2px dashes with gaps, not a stroke. The 1px-at-1x line is being point-sampled during downscale instead of area-averaged. Compare `overlay-cropped-4x.png`, where the same stroke is continuous. A dotted trail is indistinguishable from the deliberate *gap* semantics in `overlay-gap.png` — the renderer is producing an artifact that collides with a meaningful state.

## 3. Trail rendered without its terminating pointer in `overlay-gap.png` — **high confidence it is visible, medium on intent**

**Where:** full image only (no trail-region crop was supplied for this one).

Two disconnected magenta segments at the lower right, and no arrow anywhere in the frame. If the gap encodes "no cursor sample here," then drawing trail while suppressing the pointer leaves a frame that reads as "something moved, nothing was there." Either the pointer should persist at last-known position or the trail should also stop.

## 4. Pointer tip sits off the trail it belongs to — **medium-high confidence**

**Where:** `overlay-cropped-4x.png` crop (too small to judge in the full image).

The trail is a flat horizontal line at y≈80 (4x). The arrow's **tip** — the hotspot — is at y≈12, roughly **17px at 4x ≈ 4px at 1x above the line**; only the arrow's tail/body touches the stroke. The trail also continues past the arrow to the right edge, so the pointer is not at the path end either. Reads as a hotspot-vs-bounding-box offset of a few pixels. At 320px wide, a 4px vertical error is ~1.7% of frame height, enough to place the cursor on the wrong UI row.

## 5. Click ring lands on the label, not on the pointer — **high confidence on the visual, medium on cause**

**Where:** `review-circle-10s-button-4x`, `review-circle-2s-button-4x`, `review-circle-crop-4x`, `review-circle-crop-scaled-4x`, `review-circle-scaled-4x`, `review-circle-10s-scaled-4x`, and all four full images (both).

Consistently across every circle variant, the ring center is ~one radius to the **left** of the arrow tip (center x≈278 vs tip x≈378 at 4x, radius ≈88), while the y offset is small (≈18). So the ring brackets **"end"** of "Send" with the cursor standing outside its right edge. The asymmetry (large x, small y) argues against a simple top-left/center swap and for a genuine click-point-vs-current-position divergence — but the readable result is that the emphasis mark and the pointer point at two different things.

## 6. Ring diameter overwhelms its target and cuts through the label — **high confidence**

**Where:** all circle crops + all circle full images (both).

The ring is ~45px across at 1x against a 116px-wide button — roughly 39% of the target's width — and its stroke passes directly through the **e**, **n**, and **d** glyphs of "Send". In `review-circle-crop-scaled-4x` the glyphs are chopped badly enough that "Send" starts to read as "S=nd". The ring also overshoots the button vertically top and bottom. A mark that obscures the very label identifying what was clicked defeats its purpose.

## 7. Ring is clipped by the frame edge in both crop variants — **high confidence**

**Where:** `review-circle-crop.png` / `review-circle-crop-4x.png` and `review-circle-crop-scaled.png` / `review-circle-crop-scaled-4x.png` (both).

The bottom arc runs off the bottom edge of the image. The mark survives cropping as a truncated arc, which no longer reads as a click ring. The uncropped `review-circle-10s.png` clears the edge by ~8px, so this is specific to the crop path not insetting for mark radius.

## 8. Ring stroke has a non-uniform alpha gradient / seam — **medium-high confidence**

**Where:** `review-circle-crop-4x`, `review-circle-2s-button-4x` crops (invisible at full size).

In `review-circle-crop-4x` the right arc is saturated magenta while the left and upper-left arc degrades to a dull desaturated mauve — a smooth gradient around the circumference, not a uniform stroke. `review-circle-2s-button-4x` shows the same with a weak lower-left arc. This looks like an arc-sweep alpha ramp rather than an intentional style, and the faded side drops well below the already-modest contrast noted in #10.

## 9. Age→opacity appears inverted between the 2s and 10s marks — **medium confidence**

**Where:** `review-circle-2s-button-4x` vs `review-circle-10s-button-4x` crops (indistinguishable at full size).

The **10s** ring is uniformly bright and fully saturated; the **2s** ring is visibly dimmer with a degraded arc. If the suffix denotes mark age, the older mark is the more prominent one, which is backwards for a decay. Flagged at medium confidence because the suffix could equally denote a configured lifetime rather than elapsed age.

## 10. Mark color sits at ~3:1 against *both* backgrounds — **medium-high confidence**

**Where:** all circle and trail images, most legible in the 4x crops (both).

The pink (~#E0489E) has no outline, halo, or contrasting keyline. Estimated ~3.4:1 against the light button (#E8E8EE) and ~3.2:1 against the dark chrome (#2B2B2B) — it never achieves strong separation on either surface and leans almost entirely on hue. Any grayscale conversion, or a mid-tone UI surface, collapses it. Every other overlay element here (green text, white-outlined arrow) carries far more headroom.

## 11. Trail crosses and obscures the frame-number text — **high confidence**

**Where:** `review-wave-2s-label-4x`, `review-wave-2s-scaled-4x` crops and `review-wave-2s.png`, `review-wave-2s-scaled.png` full images (both).

The sine trail passes straight through **"frame 25"**, slicing every glyph. In the scaled variant the stroke is thick enough relative to the 8px text that the **2** and **5** are materially degraded — at a glance it can read as "frame 75" or "frame 23". The trail has no z-ordering or avoidance relative to the diagnostic HUD text, and the HUD text is the ground truth a reader needs to trust the frame.

## 12. Pointer is ~2.4x oversized relative to content after scaling — **medium-high confidence**

**Where:** comparison of `review-pointer-only-button-4x` against `review-pointer-only-scaled-4x`; also `review-wave-2s-scaled-4x` (crops; inferable but hard to confirm at full size).

At 320px the arrow is ~8.5px wide (2.7% of frame width). At 160px it is ~9.5px wide (5.9% of frame width). The glyph is being composited at a near-fixed pixel size after the downscale rather than scaled with the content, so the scaled frames show a cursor more than twice as large relative to the UI. In `review-wave-2s-scaled-4x` the arrow is visibly bulkier than the "Send" cap height, which is not true in the source. Presumably a readability floor, but it is currently overshooting and distorting apparent pointer-to-target proportion.

## 13. Pointer reads as outline-only on dark backgrounds — **medium-high confidence**

**Where:** `overlay-pointer-label-4x`, `overlay-cropped-4x` crops (both; hard to judge at full size).

The arrow is black-filled with a thin white keyline. Over the #2B2B2B chrome the black fill is nearly indistinguishable from the background, so the glyph survives only as a ~1px-at-1x white hairline. It holds up in `review-pointer-only-button-4x` because the light button backs the black fill, but over dark UI — the majority surface in these frames — the pointer is carried entirely by a single-pixel outline that will not survive compression or further downscale.

## 14. Thumbnails destroy all HUD text — **high confidence, likely acceptable**

**Where:** `review-clean-thumbnail-4x`, `review-pointer-only-thumbnail-4x` crops (both).

At ~46px wide, "t=2.500s" and "frame 25" are unresolvable smears and the "Send" label is noise. Notably the **pointer is still legible** in `review-pointer-only-thumbnail-4x` — so the thumbnail tier preserves the cursor but loses the timestamp needed to place it in time. Worth confirming that is the intended tradeoff, since it inverts the failure in #1.

---

## Cross-cutting

Two patterns account for most of the above. First, **the scaling path is unreliable for thin overlay geometry** — it drops the pointer (#1), dashes the trail (#2), and inflates the cursor (#12); marks are evidently composited at different stages than the content they annotate. Second, **overlays have no awareness of what they cover** — the ring bisects "Send" (#6), the trail bisects "frame 25" (#11), and the crop path clips the ring (#7). An inset-for-mark-radius rule on crops, and an outline or halo on the mark stroke, would address #6, #7, and #10 together.

Lowest-confidence items are #9 (depends on what the `-2s`/`-10s` suffix denotes) and the *cause* of #5 (the offset is definitely visible; whether it is a bug or a legitimate post-click pointer move I cannot tell from stills). No files were modified.
