# Native capture checkpoint

Scope: own generated window, video only. The integrated native build, clock and
generation checks, and bundled wire tests pass. Preflight reports existing screen
and microphone authorization; no permission was granted or narration recorded by
these checks.

[Verification](verification.json) records the retained source hashes, actual native
results, ffprobe frame counts and full ffmpeg decode checks. Short pause and source
loss videos are retained beside this report. The five-minute source remains at its
recorded scratch path; its measurements and first/last images are retained here.
All three decoded successfully, with reported versus container duration differences
below one millisecond. This is video timing evidence, not A/V drift evidence.

A fresh screenshot-critique inspected the full frame set and enlarged label crops.
All nonblank frames retain four correctly placed, legible quadrant labels, without
clipping, inversion, tearing or obvious corruption. Title-bar text has low contrast;
main labels remain clear. The hidden-window final frame is near-white and loses all
panels. The cause is not established by a screenshot. Hidden-window framing remains
open; no white-pixel heuristic or inactivity timeout is used to invent source loss.
[Metrics](visual-metrics/scene-metrics.json) retain the observed near-white result.

Independent code review found two issues. Explicit permission request actions now
exist for fresh installations, while ordinary launch/preflight remain read-only.
The actual fresh-authorization interaction still needs a suitable user-run case.
Temporary encoder backpressure during held-tail finalization is being fixed on
`fix/capture-finalization`; this checkpoint does not mark that finding resolved.

Still unverified: display/region capture, isolated microphone/system audio, A/V
alignment, denied permissions and microphone disconnection. Recovery and geometry
have their own gates. The menu-bar app is not yet a complete user recording flow.

The repository-local compare-screenshots helper regenerated telemetry after an
inconsistent provisional edge metric was discarded. It reports zero detected
edges for the near-white hidden-window image. Command: `REPO_ROOT=/Users/david/dev/game
CANDIDATE_DIR=<this capture folder> OUT_DIR=<this folder>/visual-metrics node
.agents/skills/compare-screenshots/scripts/visual-parity-diff.mjs`. The other repo
supplied existing pngjs/pixelmatch dependencies only; its files were not changed.
