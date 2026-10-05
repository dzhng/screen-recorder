# User decisions and feature boundaries

The user chose Design A and clarified that saved recordings should move out of
the menu. Camera Only was included after the camera-capability option was
presented. The independent Library remains open until closed. Inline Allow/Retry
recovery and the expanded four-tile concept density were also selected.

The user selected a hard cutover with no compatibility shims or data migrations.
The implementation preserves current persisted media contracts. Later, the user
explicitly accepted unverified live-device checks and requested lean verification.

Routine native dismissal, window restoration, input locking during a take,
system appearance and scrolling were delegated during design exploration.
These implement the selected immediate capture access and persistent browsing.

The public camera-primary source is `{kind: "camera", deviceId: "selected-id"}`.
Top-level `cameraDeviceId` belongs only to a screen take's companion camera.
Camera primary uses ordinary primary publication; it has no companion camera
allocation or publication. Microphone/system-audio meanings remain shared.

The feature excludes automatic editing/composition, original-media modification,
live camera preview, generated thumbnails, global search, a complete export
archive, a new audio backend and release/install work. The closed README owns
the durable invariants; the operation schemas remain authoritative in code.
