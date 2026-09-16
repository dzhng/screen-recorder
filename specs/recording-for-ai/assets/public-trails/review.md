# Delivered default cursor trails

The generated [public fixture](../../../../apps/macos/tests/trail-inspection.test.mjs)
launches the actual bundled app/service and native worker, then reads images through
CLI and MCP. The source depicts a localhost billing page with a circle around the
free plan and a wave over Upgrade. Its cursor journal is synthetic: this verifies
planning, rendering and delivery, not physical cursor acquisition.

## Pixel and timing evidence

The [metrics](metrics.json) retain source hashes, delivered metadata and measured
pixel differences. Against the identical clean frame, pointer-only changes 100
pixels, default history 6,177 and short history 2,174. The old circle disappears
from pointer-only, short and post-pause results. A compatible future image retains
only pre-request pointing; a changed future image is pixel-identical to its clean
counterpart and reports the future-scene cutoff. Original video/journal hashes
remain unchanged. CLI files and MCP image payloads match byte for byte.

The pixel gate was also falsified: temporarily suppressing native overlay output
while retaining its receipt made the public test fail on actual pixel differences.
Restoring the renderer and rebuilding returned the test to green.

All eight delivered images and matching enlarged crops are retained here. Crops
are inspection aids; full frames preserve framing and actual output resolution.
The target is visible pointing with readable underlying labels, a fading history,
and no trail on clean or ineligible changed-screen images.

## Independent visual review

A fresh non-Claude agent inspected every full image and crop. It found no major
defect: recent trails and pointer endpoints are identifiable and text remains
readable. Minor limits are real: paths cross text, older segments are faint on
pale surfaces, and the generated dark page has lower-contrast fixture labels.
Clean images have the same fixture softness/contrast, so those are not annotation
regressions. The initial pause crop missed the lower path; its replacement includes
the entire path and pointer and passed the follow-up review.

Retain the existing fading style provisionally. Moving a path away from text would
misrepresent the observed coordinates; widening or darkening it needs denser real
content evidence first. Static shots do not prove motion smoothness, all intermediate
reset states, or real-world gesture capture. The broader slice remains open.

## Integrated verification and review

Build/type checks, 138 core tests, 56 service tests, 13 CLI tests and 9 protocol
tests pass. Public native tests pass for these trail images, existing clean
own-window frames, sparse eight-image batches, source cuts/cache regeneration,
audio roles/gaps/retry and scene timing. Lint and formatting pass.

The shape review keeps one frame planner, queue, cache and native renderer. Service
composition shares one native-result/error adapter; CLI/MCP contain no separate
annotation policy. Targeted frame/audio requests admit their first source-processing
attempt through the existing queue without implicitly retrying failed dependencies.
Independent Codex review found no actionable regression; its sandbox could not run
local socket/native integration, which the host checks above supply.
