# Visual review

Fresh agent `finish_acoustic_raster/raster_visual` inspected all six full images and all six twice-sized crops without project history. Initial findings: medium-confidence ambiguity where impulse peaks touched the plot border, minor singular-channel grammar, and slower scientific-notation frequency labels. The final native renderer gives peaks five percent headroom, uses singular/plural correctly, and prints integer Hz. Native output hashes changed for every state; underlying measurements did not change.

The reviewer reinspected the complete final set and reported: “No remaining concrete visual defects found.” Peaks clear the border; channels, legends, truncation notice and both subpixel signals remain clear. Confidence was high for these visible checks. Implementer inspection agrees: impulse position is consistent between overview and detail, grey intervals align between channels, and the spectral impulse stays on the second channel. No listening or public lifecycle claim follows.

`scene-metrics.json` was calculated from ffmpeg-decoded RGBA pixels (the skill helper could not load its absent pngjs dependency). Every image is opaque and has substantial luminance contrast. Low entropy is expected for sparse measurement plots and is not used as a success threshold. Signal positions and channel distinction are checked separately by the real native test.

Independent code review found no actionable defects. Its final native run used a stale binary and rebuild was blocked by its compiler/SDK environment; the implementer's freshly rebuilt binary passed the retained final test and source-frame preservation test. The earlier independent review did build and pass the pre-headroom native gate. These boundaries are kept separate.
