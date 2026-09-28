# Picture-only planning

A mixed picture/retimed-audio fixture requests a narrow interval inside the second
global picture. Its video window returns the same frame as the movie schedule,
including the earlier sample time and clipped visible interval, while requiring
only the video executor. Audio targets are refused for picture inspection.

The new test failed before the video-window API existed, then passed unchanged
apart from strengthening its requested duration to include real audio samples.
The integrated composition/core audio/preview checks passed 135 tests. Dependency
builds and workspace types passed. Independent review found no actionable
regressions and separately passed all 120 composition tests and composition types.

This generalizes the existing component filter; it adds no scheduler or renderer.
Native still delivery, image comparison, index projection and public routes remain
required gates in the owning slice.
