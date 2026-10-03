# Verification record

Base `66c9d14e`; frozen native worker SHA256
`6663e0c169671fa8121ed26e9cf298fb0dd0d789fd5559954899af1e87b608b9`.
The CLI/core dependency build succeeded with six cached tasks. It refreshed five
compiled JavaScript files; before/after hash inventories are retained. `built`
is the lossless confirmation after that refresh. `initial` lacks the later
channel oracle; `channels` includes it. `compressed-regression` exercises the
unchanged default compressed selection. Each run also completes the original
mixer journey, preserving its gain, gap, cancellation and scale checks.

```sh
SCREENREC_NATIVE=/tmp/screenrec-caption-output-combined-native \
SCREENREC_RATE_EVIDENCE=/tmp/screenrec-lossless-boundaries-built \
SCREENREC_RATE_COHORT=lossless-boundaries \
node packages/test-harness/editing/audio-mix.mjs --case music-and-replacement
```

For both lossless cases, the full two-second mix has 96000 stereo frames; the
123457–1812349 µs range has 81067 frames, and the final 20003 µs has 961 frames.
Native source ranges use their own exact floor-clock projections. Authored source
PCM, independent float sums, full/range/tail component and mixed samples, and
333333 µs split output all compare exactly. Mono output channels match exactly.
The 192 kHz channels retain their independently authored 430/1700 Hz identities;
a swapped-channel sample control fails that same identity check. Omitted-input
and one-frame-shift controls fail the exact-sum oracle. Detailed powers and
maximum/RMS values are measurements in each report, not new tolerances.

Read-only independent code review found no actionable defects. No native binaries
were run by the reviewer. Formatting, syntax and diff checks pass. There are no
new acoustic pictures to review and no audio playback/listening was performed.
The earlier AAC reproducibility failure remains open in the linked preceding
checkpoint; a zero delta in this compressed regression does not resolve it.

## Inspect retained artifacts

`archive.json` identifies the archive hash, byte size and path count. Unpack into
an empty directory and verify all original bytes:

```sh
mkdir /tmp/lossless-rate-evidence
tar -xJf captures.tar.xz -C /tmp/lossless-rate-evidence
cd /tmp/lossless-rate-evidence
shasum -a 256 -c SHA256SUMS
```

Each run directory contains the complete WAV capture set and report with native
requests, receipts and media hashes. `diagnostics` contains execution/build/review
logs and compiled-module hash inventories. Historical temporary paths in receipts
identify the original invocation; use the archive paths for retained media.
