# Compiled picture execution

[The picture executor](CompositionPictureExecutor.swift) executes one graph for
still images and movie frames. Project placement, source choice and parameter
clocks come from the [composition compiler](../../../../packages/composition/README.md).
Native code resolves physical sample support and draws pixels; it does not
reconstruct cuts or restart frame phase at a preview origin.

Prepared sources retain the shared media input for the decoder's entire lifetime.
Path replacement and closing an inherited caller handle cannot redirect the
selected pictures. Metadata preparation checks primary chunk storage before
enabling whole-source streaming; external reference movies refuse.

PNG and movie encoding consume the same graph through different output targets.
Keeping still encoding separate avoids quantizing an inspection image through
movie color conversion. Source support and orientation remain shared.

Physical empty edits and compiler-excluded source pictures can become background
only under the admitted selection. Missing ancestor support or unknown physical
timing cannot be repaired by finding another child picture. Reused decode state
must retain each occurrence's own selection and acquisition disposition.

Pointer runs are supplied evidence, not inferred gestures. Missing observations
leave missing marks; coordinates use half-open source pixels. Readability is judged
in delivered pixels, so thumbnail sizing must account for source crops and ancestor
transforms rather than applying a second independent mark-size rule.

[The video renderer](CompositionVideoRenderer.swift) consumes bounded compiled
records with their original sample times and clipped visible intervals. Publication
uses the shared new-file owner. [Appearance and temporal references](../../../../packages/test-harness/editing/README.md#platform-reproductions)
separate pixel execution from codec loss and physical-input acceptance.

[Picture observations](PictureObservations.swift) measure the very CGImage sent
to lossless PNG encoding. The requested rectangles use delivered top-left pixels,
after orientation, sizing and composition. Observation does not draw, crop or
change color treatment. A separate profile-managed sRGB RGBA8 measurement retains
its raster digest, the rendered input profile and actual measurement profile;
a named CoreGraphics space without exportable ICC bytes keeps an explicit absent
hash. This is not source-media tag equivalence.

Only fully opaque pixels contribute to luma and channel metrics. Transparent,
partial-alpha, clipped and outside-raster coverage remain explicit. Edge bands
are measured contiguous dark candidates; a completely dark scene may reach the
opposite edge without an observed transition. Neither case proves letterboxing
or authorizes cropping. Region names describe the caller's rectangles, not native
face detection or universal exposure targets.

[Face observations](FaceObservations.swift) run Vision on that same delivered,
upright CGImage when explicitly requested. They return every detected box in
top-left pixel coordinates, preserve no-face and detector-error states, and
carry no person identity or largest-face selection. This is evidence for the
caller; it never changes composition or framing.

Native text retains its literal UTF-16 and imported font identity. Glyph-path
bounds own vertical placement; decorations retain separate bounds and clipping.
Rounded stroke joins keep acute glyph corners inside the reported half-width
expansion instead of producing unreported sharp spikes.
