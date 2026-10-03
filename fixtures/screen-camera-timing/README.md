# Physical screen and camera take

A real iPhone camera pointed at this Mac's timing page, with separate Mac screen
and MacBook microphone recordings. The user requested retention here for ordinary
video import tests as well as cross-source timing work, and shortened the take to
roughly 200 seconds. No further recording is required to use this fixture.

The retained camera lasts about 246 seconds and screen/microphone about 251 seconds;
duration is already sufficient for the requested take. Exhaust these originals,
journals and existing analysis before contemplating a new human recording task.
[20](https://github.com/dzhng/screen-recorder/blob/f362b1f6cf9fa2ae558150a717210ef6a5b09dac/specs/agent-editing/slices/20-camera-reproduction.md) owns the remaining
measurement/lifecycle claims and their uncertainty; an incomplete detector result
is not proof that the recording is unusable.

[The manifest](manifest.json) pins the exact original bytes, observed stream
metadata and capture context. Feed the standalone movies to ordinary `asset.import`;
do not manufacture recording/catalog rows or require this recorder's sidecars.
The camera movie is `camera/camera.raw.mov`, the screen is `screen/video.mov`, and
the separate microphone is `screen/narration.packed.mov`. These are interrupted
fragmented originals with readable retained media, not normalized exports. Their
origins and durations differ; do not align them by assuming every file begins at zero.

Source movies, capture journals and raw timestamp observations are tracked with
Git LFS; the request, manifest and this usage guide are ordinary Git files. Run `git lfs pull`
after cloning if the checkout contains LFS pointers instead of media.
The original capture request and journals retain the initially planned longer take;
the manifest records the user's early stop. Do not silently trim or overwrite the
originals to make those durations agree. The scheduled five-minute pause did not occur.

[Public import evidence](../../specs/done/agent-editing/assets/20-physical-import/README.md)
verifies all three files, bounded early/middle/late picture delivery and an actual
microphone excerpt. It does not establish cross-source synchronization or completed
camera canonical recovery. Treat the footage and audio as personal content.
