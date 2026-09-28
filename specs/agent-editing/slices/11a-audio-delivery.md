# 11a — Shared source and project PCM delivery

Status: in progress. Native source-window WAV extraction and core cached admission are integrated; public source routing and shared capacity preflight are integrated; actual native public delivery and project taps remain open. Dependencies: [08](./08-audio-mixing.md), [09](./09-first-preview.md), [10b](./10b-source-acquisition.md).

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
node packages/test-harness/editing/audio-extraction.mjs --fixture selected-streams
```

## Acceptance

Actual CLI/MCP WAV delivery checks stream selection, capture-context exclusion,
source offsets/gaps, both channels, full/range sample parity, all nested processing
taps and bypass, original hashes, cancellation/retry and full-extraction memory.
Known impulses and excluded-source poison must obey the existing sample boundaries.
Current constant gain executes; future retime/denoise conformance stays open until
those processors are verified. Existing raw audio and movie gates remain green.

## Open full-extraction capacity gate

The shared cache now defaults to 4 GiB, enough for the native sink's supported RIFF
capacity. Its shared intrinsic-size check runs before selected-source rendering when
native rate/channel metadata is available, and again against actual publication bytes.
This check is not a reservation: active leases can still cause retryable publication
pressure, and unfinished outputs can temporarily consume disk beyond the published budget.
The [capacity pass](../assets/11a-cache-capacity/README.md) proves real sparse publication
above 1 GiB and bounded reading, not a native render of that size. A real full native
WAV above 1 GiB and project-tap preflight remain required before closing this gate.

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
memory point measurement is not full scale acceptance. Public API acceptance
and processing taps remain required before this slice can close.


## Public source route

[Routing and delivery evidence](../assets/11a-public-routing/README.md) records
selected-source admission through audio.get/retry, shared artifact leases and
bounded CLI file streaming. Large MCP audio remains an explicit renewable
artifact; small audio can be inline. Actual native source/large-WAV acceptance
belongs to the audio-extraction journey, and project tap binding remains open.


## Active native coverage defect

The long AAC source journey reproduces a 1024-frame decoded shortfall in a direct
native extraction; a plain AVAssetReader diagnostic can retrieve the complete
source. No support shortening or compensating silence is accepted as a fix.
Lossless extraction and full CLI delivery above 1 GiB pass separately; their
retained evidence is pending integration. Resolve the AAC native owner and
preserve the existing recording/composition audio gates before closing this slice.
