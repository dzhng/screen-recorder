# Face observation checkpoint

This checkpoint freezes the first slice of face localization: an explicit
`vision-face-rectangles-v1` request runs Vision on the same delivered upright
CGImage used for PNG publication. It returns every detector box in top-left
integer pixels, sorted deterministically left-to-right, with native confidence.
`no_face` and detector `error` are retained as states; no largest-face choice,
person identity or framing edit is inferred.

The native no-face control is in
[FaceObservationTests.swift](../../../../helpers/mac/Tests/YapFrameTests/FaceObservationTests.swift).
The protocol admission and contradictory-state tests are in
[faces.test.ts](../../../../packages/protocol/src/faces.test.ts).

Temporal association, occlusion gaps, scene resets and real multi-face fixture
coverage remain the next checkpoint. This evidence does not claim tracking,
identity or a reframe.
