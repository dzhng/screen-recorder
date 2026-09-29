# Native sample identity at arbitrary physical phase

The common reader retains a physical run's sample origin separately from its
selected/acquired support. Native frame addresses own selection and packet
consumption. The output keeps its declared floor sample grid. A clipped acquisition
mask does not become a new physical sample origin, and no capture anchor is snapped.

## Cause and rejected shortcut

With a100001us physical origin, native44.1/48k full reads match original payload
exactly, but late reads select one earlier sample. At48k the global seek57598/48000
returns original frame52797; preserving the run phase in the seek returns52798.
Both packets report the same timestamp57598/48000. The old reader discards two
samples from each and therefore selects52799 versus52800. The packet-only probe
establishes this difference before AVAudioConverter.

A seek-only exact-time change is insufficient. Above half a native sample, moving
within one source sample cell can change reported packet timestamp while payload
identity stays the same. Timestamp subtraction cannot determine the first payload
sample. The retained low/high phase probes show this directly, with exact authored
sample identities. Scratch rephasing and subsequent canonical storage controls are
retained separately; the latter own the independent payload comparisons.

## Seek representation and ownership

For an already selected sample cell, the reader requests ceil(cellStartUs)+1us.
This point is strictly after the exact start and at most2us after it. Every admitted
native rate is at most192kHz, so each sample cell exceeds5.208us. The point is
strictly inside without requiring the physical phase and native rate to share a
CMTime timescale. Existing public source/offset bounds leave ample Int64 room;
checked exact arithmetic and checked addition retain explicit capacity errors for
invalid extreme metadata. No new integral-rate domain or LCM refusal is added.

The reader seeks at most two codec packets before the selected native address,
clamped to its physical run start. Counted discard and bounded packet storage
remove this context before conversion. Packet timestamps validate continuity on
the native frame grid; they never assign payload identity. Nearby selections in
the same physical run can reuse buffered data; distant/new runs seek again.
Existing one-retry AAC tail recovery retains the same native address semantics.
Nearest-source selection, ceil end coverage and output-floor placement remain
separate from choosing a point inside the already selected seek cell.

## Verification and limits

Full/late native44.1/48k and project48k output now match complete full-output slices,
including44.1-to48k resampling. Independent original PCM verifies full native
placement. The new regression covers phase below/above half a sample and acquisition
mask boundaries on both sides. Earlier aligned rational segments, source offsets,
gaps, poison isolation, fractional-rate refusal and bounded late reading pass.
The20ms late read still decodes8192 frames from a60s source.

Packet probes retain exact early/late/tail samples for AAC, MP3, a non-grid AAC
passthrough edit, and second physical runs with both rational and rounded anchors.
Second-run samples match the original source identities. Separate converter probes
retain complete low/high-phase full/context output and show exact period-aligned
44.1-to48k slices. The production integer-rate mixer cohort also passes8/44.1/48/192k
full/range/tail/split controls. The legacy excerpt suite passes unchanged resampled
edge thresholds and lookahead behavior. No codec-quality or listening claim follows.

A library seeded with old ready source/project/late/preview/prepared/waveform jobs
gets six new identities under the corrected execution namespaces. Complete public
source, project and prepared PCM match authored source samples; the late source
starts at52800 rather than old52799. Preview verifies new publication, not AAC
sample equality. Transcript decoder identity also changes; no new ASR inference
was run. Prepared/acoustic recipes inherit upstream identity; picture-only output
is unchanged. Existing original receipts retain their provenance.

Native builds, focused service/CLI build,39 core cache-owner tests and independent
read-only review pass. Initial fixture failures are retained: source input needed
headroom beyond the selected interval, and the AVURLAsset needed explicit lifetime
through asynchronous export. The fixture was corrected; no reader threshold or
PCM oracle changed. Original capture diagnostics remain frozen in20b-window-phase;
root owns its transition from diagnostic reporting to an asserted correction gate.

`verification.json` hashes every archive member and the frozen worker. The archive
contains causal probes, original media, complete red/green PCM, public receipts,
new regression media and preservation/review logs. Programs retain their original
scratch paths. Reproduction uses isolated fresh output/library directories, with
old-implementation cache seed before new-implementation verify. No live capture,
playback, model download or writer/journal policy change was involved.
