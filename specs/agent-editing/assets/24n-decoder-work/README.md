# Actual source work evidence

The accounting contract passes. Selected-window descriptor I/O remains open:
a late 20 ms request from the 60-second WAV read the entire 11,520,044-byte
source in one retained run (11,520,058 `pread` bytes including repeats/header).
The final run read 706,618 bytes for identical selected PCM and decoded-frame
counts. This schedule-sensitive red is not fixed by adding telemetry.

`report.json` and `evidence.tar.xz` retain the final requests, actual native
receipts and complete PCM/source operands. `media-hashes.json` checks the archive.
`full-file-read-observation.json` retains the earlier real read amplification,
including its worker hash. No frozen prior codec evidence was altered.

The 60-second 48 kHz and 44.1 kHz lossless sources each decoded 8,192 native
frames for a late 20 ms window, versus 2,880,000/2,646,000 frames for complete
renders. Full-versus-window PCM is byte exact. Omitted sources decode nothing;
fragmented clips, one input with disjoint availability and short RNNoise
preparation preserve complete PCM and count each decoder lifetime once.
The final 13-case run peaks at 42,713,088 worker resident bytes.

The existing 3,000-second AAC marker was reused without encoding/restoring a
long output; its hash is in the report. A 20 ms window at second 2,999 decoded
8,192 native frames. All 1,920 float samples matched the two-second tail reference
in this run; the permanent assertion remains the inherited AAC maximum/RMS
numerical conformance bound. This does not close any prior cross-invocation
codec diagnostic or constitute a new quality tolerance.

## Measurement boundaries

`sourceWork` counts AudioSourceReader output before discarded context and source
MediaInput descriptor reads. Float32 bytes are decoded sample payload, not
compressed I/O. Descriptor reads count positive `pread` results, repeated reads
and the 12-byte container sniff; delivered bytes count only chunks supplied to
AVFoundation. Neither metric is physical disk traffic. URL inputs and the raw
retained-PCM path explicitly report unknown read inputs. Processing scratch I/O
is excluded, so these are not total-request I/O numbers.

The existing request Sources owner accumulates retired readers without keeping
them alive. Only the final public stream snapshots descriptors; internal
preparation reports omit that snapshot, avoiding a sources-times-members scan.
This distinction is explicit at the public open call, not inferred from tap shape.
Sampling, reader seeks, 64 MiB inspection budget and cache identities are unchanged.

## Verification and next pickup

Release worker built from b409e225 plus this pass; its exact hash is in the
report. SourceAudio owner tests and both native composition-plan/retained-PCM
checks pass. Original worker fails the new accounting assertion. Dropped decoder
counts fail the harness, and restoring the old budget-only delivered counter
fails with streaming read=23,085,070/delivered=0. Restored tests pass.
Two independent Codex reviews reported no actionable findings; the second
covers the final-only snapshot and additional gap checks. Shape review kept
telemetry in existing owners and eliminated repeated intermediate snapshots.

Run the harness with `SCREENREC_NATIVE` pointing at the release worker,
`SCREENREC_LONG_AAC` pointing at the hash-pinned retained marker, and a new output
directory as its positional argument. No devices, playback, downloads or app
cutover are involved.

Next: scratch-trace descriptor requests (offset, requested length, all-data flag,
metadata/decoder phase and cancellation), then reslice the input owner. Never
complete a partially fulfilled request as though all bytes were delivered or
substitute a filesystem path for the inherited descriptor. Parent24 remains open;
this is neither full two-hour source I/O proof nor a physical disk benchmark.
