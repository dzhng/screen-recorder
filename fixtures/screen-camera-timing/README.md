# Physical screen and camera take

A real iPhone camera pointed at this Mac's timing page, with separate Mac screen
and MacBook microphone recordings. The user requested retention here for ordinary
video import tests as well as cross-source timing work, and shortened the take to
roughly 200 seconds. No further recording is required to use this fixture.

[The manifest](manifest.json) pins the exact original bytes, observed stream
metadata and capture context. Feed the standalone movies to ordinary `asset.import`;
do not manufacture recording/catalog rows or require this recorder's sidecars.
The camera movie is `camera/camera.raw.mov`, the screen is `screen/video.mov`, and
the separate microphone is `screen/narration.packed.mov`. These are interrupted
fragmented originals with readable retained media, not normalized exports. Their
origins and durations differ; do not align them by assuming every file begins at zero.

Large source media, journals and raw timestamp observations remain locally in this
fixture directory, excluded from Git; the manifest and this usage guide are tracked.
The original capture request and journals retain the initially planned longer take;
the manifest records the user's early stop. Do not silently trim or overwrite the
originals to make those durations agree. The scheduled five-minute pause did not occur.

[Public import evidence](../../specs/agent-editing/assets/20-physical-import/README.md)
verifies all three files, bounded early/middle/late picture delivery and an actual
microphone excerpt. It does not establish cross-source synchronization or completed
camera canonical recovery. Treat the footage and audio as personal content.
