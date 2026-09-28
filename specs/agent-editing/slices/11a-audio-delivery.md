# 11a — Shared source and project PCM delivery

Status: verified for the admitted source formats and current constant-gain project execution. Actual source and multi-source project WAV journeys, processing taps, shared capacity checks and combined-runtime preservation pass. Dependencies: [08](./08-audio-mixing.md), [09](./09-first-preview.md), [10b](./10b-source-acquisition.md).

## Contract

An agent receives bounded WAV excerpts or full selected-stream/project-target WAV
through the public API. Raw and processed inspection uses the same source selection,
processing and absolute sample clocks as preview/export.

## Seam and ownership

Use the role-free selected-source PCM producer established in 10b and the existing
CompositionAudio finite stream. WAV encoding is a sink for those producers; there
is no synthetic single-clip project for raw extraction and no separate mixer.
The native `media.mixCompositionAudio` operation already exists: reuse it and its stream,
not a new PCM executor beside it.

Core shares composition dependency/capability binding with preview. Job/cache/
delivery/deletion ownership remains shared. Full extraction is bounded background
work. Original media stays immutable.

## Work and review surface

Add flat source `{assetId, streamId, acquisitionId?}` and project
`{projectId, revisionId?}` selectors to audio inspection. Optional range defaults
to the selected stream bounds or full pinned project. Source output keeps the
stream's supported native rate/layout by default; project output uses its verified
sample clock. Return actual rate/channels, range origin, sample bounds and explicit
unavailable support. Unsupported layouts refuse rather than silently remapping.

Project requests select existing dry/after-step/processed clip, track, group or
output taps. Child taps exclude parents explicitly. Reuse compiler capability
rejection for retiming and processors not yet implemented; do not fake stretched
or denoised audio. Stateful preparation contracts join the same seam when ready.

```sh
node packages/test-harness/editing/audio-extraction.mjs --out /tmp/audio-extraction-evidence
```

## Acceptance

Actual CLI/MCP WAV delivery checks stream selection, capture-context exclusion,
source offsets/gaps, both channels, full/range sample parity, all nested processing
taps and bypass, original hashes, cancellation/retry and full-extraction memory.
Known impulses and excluded-source poison must obey the existing sample boundaries.
PCM and lossless full/range output is byte exact. AAC comparison preserves exact
sample counts, clocks, channels, and endpoint frames, while requiring both RMS and
maximum absolute error below one 16-bit quantization step (1/32768). This codec-only
contract corrects a pre-existing assumption: the frozen prior decoder itself emits
slightly different floats for full versus seeked AAC reads, including packet-aligned
seeks. It does not permit padding, dropped samples, normalization, or relaxed timing.
The [source extraction evidence](../assets/11a-audio-extraction/README.md) separates
that numerical finding from the missing-packet regression.

Current constant gain executes; future retime/denoise conformance stays open until
those processors are verified. Existing raw audio and movie gates remain green.

## Full-extraction capacity gate

The shared cache now defaults to 4 GiB, enough for the native sink's supported RIFF
capacity. Its shared intrinsic-size check runs before selected-source rendering when
native rate/channel metadata is available, and again against actual publication bytes.
This check is not a reservation: active leases can still cause retryable publication
pressure, and unfinished outputs can temporarily consume disk beyond the published budget.
The [capacity pass](../assets/11a-cache-capacity/README.md) proves real sparse publication
above 1 GiB and bounded reading, not a native render of that size. The source journey below supplies real native
extraction above 1 GiB; project tap preflight is covered in the core tap evidence.
The [large project journey](../assets/11a-large-project-audio/README.md) verifies
100 clips on two simultaneous tracks, a complete 1.15 GB PCM oracle, late fractional
reads and bounded sampled memory. General high-track/multi-hour stress remains 24.

## Failure boundary and discretion

If inspection and preview disagree, fix their shared owner. Do not normalize levels,
trim gaps or alter timestamps solely to make an inspection fixture pass.

Delegated: sink/stream integration and bounded artifact scheduling. Source binding,
sample counts, channel reporting and tap scope are fixed. Record verification and
remaining limits in Status and the README pickup.

## Integrated prerequisite

[Native source-window evidence](../assets/11a-native-source-window/README.md) proves
absolute sample-clock windows, fractional full/range equality, actual selected
channels, capture/physical gaps, excluded-source isolation and bounded late reads.
Main integration rebuilt the native worker and source fixture, then passed all 13
source/audio/speech wire tests. Existing recording spans remain byte-identical to
the frozen baseline in the delegated proof; no fresh ASR inference is claimed.

The current source format contract is integral native rates and conventional
mono/stereo. Larger layouts and fractional rates refuse. The shared float-WAV
sink refuses payloads beyond UInt32.max minus a 4096-byte header reserve before
creating output. Slice 24 must assess long-output/format limits; the 60-second
memory point measurement is not full scale acceptance. Public source delivery and project processing taps are verified below.


## Public source route

[Routing and delivery evidence](../assets/11a-public-routing/README.md) records
selected-source admission through audio.get/retry, shared artifact leases and
bounded CLI file streaming. Large MCP audio remains an explicit renewable
artifact; small audio can be inline. Actual native source/large-WAV acceptance
belongs to the audio-extraction journey below. Project taps are covered by their
separate public journey.


## Native source delivery checkpoint

[The real source WAV journey](../assets/11a-audio-extraction/README.md) verifies
selected streams, masks, gaps, poison, cancellation and complete CLI transfer
above 1 GiB for silent and non-silent AAC, with bounded MCP reads. The shared
decoder's missing tail is corrected with bounded context and once-only exact
continuation; no missing speech is padded. [Signed-start preservation](../assets/11a-signed-audio-start/README.md)
also protects admitted negative origins.

[Execution pins](../assets/11a-audio-execution-pins/README.md) distinguish new work
without changing retained portable transcript schemas. The [combined-runtime check](../assets/10d-public-project-frames/README.md)
verifies service execution pins, concurrent staging, full source delivery and
preview/export preservation. The large project journey completes this slice's
full-output gate; broader format/scale contracts remain separate.

## Public project audio and render lifetime

[Wired tap evidence](../assets/11a-public-project-taps/wired-render/README.md)
verifies actual CLI/MCP WAVs for nested processing and bypass, history, restart,
cancellation/retry and deletion. Audio encoders stage inside the existing locked
render attempt; only completed WAVs enter the cache. This prevents abandoned
encoder staging from escaping startup cleanup. The [integration pass](../assets/11a-capture-routing/README.md)
separates process-lifetime checks from decoded-media conformance.

## Continuous availability preservation

[Touching-support evidence](../assets/11a-touching-support/README.md) verifies that
adjacent source availability declarations produce exactly the same WAV as their
union, without erasing real gaps or relaxing recording cut validation.
