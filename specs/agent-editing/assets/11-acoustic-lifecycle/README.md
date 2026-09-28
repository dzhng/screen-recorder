# Acoustic preparation and image delivery

One acoustic owner prepares source/project measurements from the existing audio
recipe and publishes both JSON and images through shared jobs, cache leases and
artifact delivery. Images depend on retained measurements, not another PCM read.
A cached image survives eviction of its measurements; rebuilding missing image
bytes requires them, and explicit retry recovers the dependency chain. Ordinary
reads preserve terminal job state. Audio and measurement generations fence late
publication, including cancellation and revision changes.

Spectral planning requests the exact surrounding FFT sample window through the
audio owner, retaining source selection, masks, project revision and processing
tap. Display bounds and unavailable support are separate from surrounding context.
An incomplete contributing source outside the display can affect an FFT column;
that column is marked without declaring the displayed interval itself absent.
The first independent review exposed this annotation gap. The source/project
regression failed before the fix, actual native pixels now show the warning, and
the public acquisition journey verifies it after deleting the donor directory.

Waveform JSON keeps its prior public shape and optional image format. Spectrograms
use bounded time/frequency images with explicit resolution controls. Channels are
separate; density and display limits are labeled. Full native provenance and plot
geometry stay in the receipt, including text too long for the image.

Large but valid matrices exceeded the small worker command envelope in the first
public run. Measurements now travel in a bounded regular JSON file inside the
existing locked render attempt. The worker refuses links, non-files and oversized
input; command size limits are unchanged. Attempt cleanup removes the sidecar on
success, cancellation and failure. No new scheduler, decoder, mixer or dependency
is introduced.

## Verification

The [actual public journey](../11-public-acoustic-images/README.md) covers CLI/MCP
bytes, independently authored samples and frequency/pixel oracles, all 15 nested
taps, outside-view capture exclusions, cancellation/retry, history and restart.
Its original canceled-read expectation was corrected against the existing distinct
artifact-readiness/job-state contract; repeated reads must preserve the same
canceled job and generation. No production status vocabulary changed.

Root checks pass: 36 focused core tests (including actual native project taps),
29 CLI tests, 18 protocol tests, core/service/CLI/protocol and dependency type checks, two actual native
image/file-boundary tests and all 20 render-lifetime tests with a frozen worker.
The existing complete WAV/waveform-JSON public journey also passes. Independent
review is clean after the context-warning fix; reviewer sandbox limitations do not
replace these unrestricted runs. Final legend pixels and fresh visual review are
retained here. Fresh image-based skill use is a separate remaining gate.

This does not establish speech boundaries, editorial cleanup, denoise/retiming
quality, natural joins or listening. Stretch-dependent artifact conformance must
also run when the retiming executor lands.
