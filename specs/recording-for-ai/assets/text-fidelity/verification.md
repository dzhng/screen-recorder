# Verification boundary

The optional owned-window capture test passed twice, with no microphone or
system audio. Both sizes then rendered through the unchanged native worker
and three bitrate-only experimental workers. Every comparison retained source
hashes, exact sampled frame times, dimensions and four-second output duration.
The final driver additionally asserts ffprobe duration and dimensions. The
unchanged worker reproduces the same output SHA on repeated renders.

Fresh image-only review is retained separately. Code review identified two
harness issues: a `/usr/bin/time` timeout could leave its child alive, and the
reproduction instructions omitted client/app/ffprobe prerequisites. Both are
resolved. The media driver now owns a process group, kills it on deadline or
excess output, and waits for actual closure. A temporary one-millisecond deadline
made a real render fail with the intended timeout and no surviving worker;
restoring the deadline returned both render cases to green. Lint and diff
whitespace checks pass.

No production encoder change survives, so this checkpoint introduces no new
encoder setting, schema, route, dependency, or runtime process owner. The optional
fixture and driver are the retained reproduction mechanism; the pixel-analysis
script remains scratch. Production timing/color/movie regressions were not
repeated for a production diff of zero. Earlier evidence remains authoritative
for those distinct gates.

## Merged review checkpoint

The integrating agent inspected the light and dark automatic outputs and enlarged
code comparison. Their source-relative readability supports the same bounded call:
keep automatic bitrate. The four-image Preview set (automatic light, source light,
code crops, automatic dark) was visibly open in one window from 21:54:52 UTC for
more than five minutes without user correction. The owned window was closed and
Preview's exit was verified through the app inventory. This is acceptance of the
controlled text comparison only; it does not close the source-end mismatch or
motion/pointer/audio gates. Merged fixture scripts pass syntax and lint checks.
