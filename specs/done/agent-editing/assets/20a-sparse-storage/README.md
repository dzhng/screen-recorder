# Sparse PCM storage proof — partial

This bounded offline proof reuses slice08's composition/passthrough mechanism with
frozen actual-CaptureWriter PCM and **probe-known** frame addresses. It establishes
container placement and process-interruption mechanics, not a production repair,
a recoverable capture journal, or physical synchronization. No device was queried
or activated. The parent camera gate remains open.

The [initial proposal](initial-proposal.md) preceded the [independent audit](independent-audit.md).
Two choices in that proposal are now superseded: rounded-microsecond run anchors
are not acceptable when they move an original sample, and packed working data need
not become an indefinitely retained duplicate after verified canonical publication.
This proof does not yet establish a safe production cleanup policy.

## What the experiment establishes

`packages/test-harness/editing/capture-sparse-storage.mjs --out DIR` owns the cases
and assertions; the existing CameraReproduction target owns native container work.
Inputs are frozen actual-writer continuous, omitted-buffer and pause payloads plus
ordinary continuous 44.1/48k controls. Exact runs identify physical frames; old
journal start/end microseconds cannot reconstruct these addresses generally.

Passthrough MOV preserves occupied/empty segments and exact rational durations
when the composition track has a representable explicit timescale. Physical decode
with edit lists disabled matches the packed input bytes: gaps are not stored
silence. The default composition timescale changed a requested boundary and failed
the initial red check. For these two rates the exact common scales are 6000000 and
441000000; the probe refuses other rates and phase denominators that do not divide
those scales. It makes no claim about arbitrary raw-host scales or LCM overflow.
Apple documents the mutable [naturalTimeScale](https://developer.apple.com/documentation/avfoundation/avmutablecompositiontrack/naturaltimescale);
the installed SDK says the default comes from the first nonempty edit (or 600).
Explicit supported scales avoid relying on that default.

Fresh processes resume after export-before-rename, rename-before-receipt, and
a diagnostic WAV publication before the final receipt. Only reproducible diagnostic
WAVs are replaced on retry; canonical and packed media remain unchanged.
An intent pins payload and mapping identities; changed intent, overlapping runs,
unrepresentable phase, excess runs, requests beyond proven payload and damaged
staging refuse. These are injected process exits, not power-loss/fsync guarantees.
The probe retains packed bytes and checks them unchanged. A successful marker
attests metadata publication, not sufficient independent PCM validation for a
production cleanup decision; the JS oracle performs that additional validation.
A corrupt temporary is preserved and refused, not silently rebuilt or published.

## Red phase result

The omitted input's second run starts at source 4800/48000 + 40960/48000 seconds.
The rounded 953333µs candidate places its first output sample at 45759; the original
position is 45760. The exact rational MOV retains 45760/48000, but the existing
SourceAudio full and late reads remain byte-identical to the rounded candidate.
At 1.2s the reader selects original sample 52801 instead of 52800. No tolerance or
fitted offset is used to accept this difference.

Continuous controls and full-versus-late consistency pass. Those checks do **not**
repair the failed original-phase contract. SourceTrack currently projects occupied
CMTime edges into TimeSpan microseconds before intersection; that is a plausible
loss boundary, not yet a fully instrumented causal diagnosis. Follow exact segment
and buffer PTS through the existing reader owner in the next bounded pass. Do not
introduce another source clock or hide the discrepancy in the test oracle.

## Next ownership decision

CaptureClock must remain source-time authority. A future exact-time extension at
that owner must preserve raw rational PTS plus the declared origin/pause offset,
with exact adjacency and explicit format/pause discontinuities. Canonical media
must carry placement so consumers need no private capture mapping. Next reslice
also needs versioned exact journal addresses, accepted-versus-committed prefix
reconciliation, normal/crash parity, bounded long-recording work, and legacy
ambiguity refusal. None is implemented here. Safe packed-staging cleanup follows
verified durable canonical publication; no indefinite 2× retention is presumed.

## Review and retention

Independent review identified a retry conflict after diagnostic publication and a
self-sized PCM oracle; both were fixed. A follow-up caught the missing invocation
of the new diagnostic interruption; it is now exercised and retries verify the
PCM bytes as well as stable canonical identity. The expected output length comes
from the requested rational endpoint, independently of reader metadata. Retained
logs preserve the findings. No production source was changed. The original
offline clock/recovery entrypoint also retains its prior scoped outcomes.

`run/report.json` is the matching retained storage result; verbose packets/logs
are gzip-compressed without changing decompressed bytes. `artifact-hashes.json`
pins evidence and source. Frozen absolute request paths record their original
environment; use the harness for relocation. The old default-timescale red is
retained separately and is not a request for the final rational-input schema.
