# Selected-source WAV delivery evidence

The public journey in [audio-extraction.mjs](../../../../../packages/test-harness/editing/audio-extraction.mjs)
uses actual native extraction, CLI file delivery, and MCP artifact reads in a scratch
home. Its independent reference reader counts decoded samples and retains only a
bounded tail. No model download, inference, capture, or playback is involved.

## Missing AAC tail

A 50-minute AAC source advertised 144,000,000 frames but the completed native reader
supplied 143,998,976. A fresh exact-tail seek also failed inside the final packet.
The fast 32-second terminal-window regression reproduces that failure with the
frozen prior binary (`tail-red.txt`); the candidate passes (`tail-green.txt`).

The shared source reader now starts with two declared packet widths of decoder
context, discarded before conversion, and may reopen once at the exact next unread
sample after a completed reader stops early. It requires forward progress and exact
continuation, does not pad or change support, and refuses a repeated shortage.
`no-recovery-red.json` removes only recovery while retaining packet context: the
long silent source again fails short coverage and leaves no partial WAV. Truncated
input and excluded-poison fixtures remain rejected/excluded.

Full silent output consumes 144,002,048 decoded frames for 144,000,000 output
frames: only the bounded recovery context is additional work. Terminal queries
consume at most 8192 frames; they do not decode the source prefix. Packet size must
be fixed and declared, from 1 through 32768 frames. Broader formats remain open.

## Separate AAC numerical contract

`old-native-parity.json` proves the frozen prior binary itself emits different AAC
floats for full and range decoding of identical source bytes. `packet-alignment.json`
keeps that mismatch across packet-aligned seeks with zero, one, two, and four extra
packets. New and prior successful range output is byte identical. The measurements
support seek-dependent floating output; they do not establish a platform-internal cause.

The approved AAC-only comparison requires exact frames, sample clocks, rate/channels,
and first/last stereo frames, with both RMS and maximum error below 1/32768. PCM and
ALAC remain byte exact. No samples are normalized. `comparison-mutations.txt` proves
one-sample drop, shift, and an excessive interior amplitude error still fail.
`strict-aac-red.json` retains the original overly broad byte-comparison failure.
This contract correction is separate from evidence for the missing-packet fix.

## Verification boundaries

`marker-report.json` and `silence-report.json` record real 1,152,004,096-byte WAV extraction and complete CLI
streaming, bounded MCP header/tail reads, selected streams/channels, fractional ranges,
physical and acquisition holes, offsets, poison, cancellation/retry, and unchanged
original hashes. The final marker run used root's locked WAV-staging runtime.
RSS is periodically sampled process RSS, not a universal peak or full slice-24 claim.
The cache size/RIFF limit and large delivery lease behavior remain shared owners.

`wire-packet-final.txt` passes native wire/source/speech boundary tests;
`composition-packet-final.json` preserves the existing mix/selection/poison gates.
`asr-pcm-parity.json` compares actual 16 kHz PCM input bytes before/after for 44.1/48 kHz
sources and selected spans. It does not claim fresh ASR inference. Frozen binary
hashes are in `binaries.json`. Compact tails, input files, requests, and reports are
retained; verified multi-GiB diagnostic outputs were deleted after hashing.

The duration-readiness hypothesis did not fix the silent-source public failure and
was removed. Earlier ALAC and AAC runs are supplemental, with their distinct binary
provenance; they are not substituted for final AAC regression evidence. Project taps
are verified by their separate owner and are not claimed by this source journey.

Independent Codex review found no actionable regressions (`review.txt`). Its local
default-binary test attempt could not run because this checkout deliberately has no
built native binary. The separately frozen native run is recorded in
`wire-packet-final.txt`; copied public-runtime fingerprints are in `runtime.json`.

Repeated poll entries in retained reports are run-length encoded without reordering;
`originalReportSha256` identifies each uncompressed report.

[Decoder execution identities](../11a-audio-execution-pins/README.md) keep new work
separate from prior cached output without invalidating portable transcript metadata.
