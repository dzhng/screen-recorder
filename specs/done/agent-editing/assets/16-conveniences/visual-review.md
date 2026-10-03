# Fresh visual critique — convenience PNGs

Inspected every supplied PNG (16 fade, 39 zoom), first as full-frame contact sheets and then 4x nearest-neighbor enlargements. Target: recognizable rectangular markers should retain their arrangement under uniform scaling, clip consistently at the output boundary, and change opacity uniformly; equivalent edit/control states should preserve the image.

**Verdict: no confirmed PNG rendering defect in this capture set.** Confidence high for the sampled geometry and opacity; these tiny synthetic frames cannot establish natural-image quality or temporal smoothness between samples.

- Fade: positions and hard rectangular edges remain fixed. Frames 2–6 visibly progress from black through dimmer colors to full intensity without one marker lagging another. Frames 0–1 and 6–7 are full intensity. The sudden full-to-black transition at 1→2 is visible; it warrants checking the intended activation boundary, but the images alone do not establish a defect. All eight static controls are pixel-identical to their matching fade frame.
- Zoom: markers enlarge coherently through 0–7, with the center gray marker staying centered and peripheral markers moving outward. Yellow exits through the top; blue, green and red are progressively cropped at the output edges. That clipping follows the enlarging image and does not resemble an incorrect inner clipping rectangle. No flipped, stretched, detached, or misplaced marker is apparent.
- Some intermediate zoom edges carry a one-pixel darker transition (clear at 4x). It is consistent with subpixel resampling, also present in the constant controls, without ringing or a detached halo. Not a demonstrated defect.
- All constant, moved and split frames exactly match their corresponding zoom PNGs; all four trim frames match 4–7 exactly. Thus no sampled edit-preservation discontinuity is visible.
- Window 0→1→2 visibly changes from full-size to smaller and back to full-size. This demonstrates an abrupt bounded activation, not a smooth entrance/exit; whether that is desirable depends on the operation's window semantics. No shape corruption accompanies it.

Only direct PNG captures were visually reviewed. No movie-derived frames were supplied in these directories, and the encoded movie error summaries are not a substitute for visually checking decoded movie frames. No claim of encoded movie visual acceptance is made.

Temporary enlargement artifacts: `/tmp/convenience-fade-fade.png`, `/tmp/convenience-fade-static.png`, `/tmp/convenience-zoom-{zoom,constant,moved,split,trim,window}.png`.
