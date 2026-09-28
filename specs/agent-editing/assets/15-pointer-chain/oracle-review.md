# Independent read-only oracle diagnosis

The reviewer inspected the native compiler/executor, source pointer construction,
reference model and retained stage artifacts without changing files or rendering
new media. The flattened PNG is not a valid strict reference for first fractional
geometry: it loses separately sampled pointer alpha/colors and the video branch.

The compiler inserts rasterize only after sourceSpace becomes false. The native
pointer originates as premultiplied DeviceRGB, is composited into a linear CI graph,
and remains a separate input before first geometry. The reference instead samples
already-flattened sRGB bytes. Transfer conversion, composition and resampling need
not commute. The source tap is opaque and exact, so the lost information is the
branch decomposition rather than output alpha alone.

The reviewer reproduced max 28 / 384 channels above 2 from existing first-stage bytes.
Using a linear flattened source instead gives max 55 / 358 above 2, disproving that
simple correction. Recommendation: import the same PNG as a still and apply the
same first geometry to discriminate the flattening hypothesis, preserving the
original threshold. Do not infer native correctness or change rasterization.

The implementing agent then ran that public control. Imported flat output agrees
with the independent linear flat model within 1 and differs from original live
pointer output by 55. This supports the branch-sampling diagnosis, but leaves the
original general pointer geometry contract unaccepted until a valid oracle exists.
