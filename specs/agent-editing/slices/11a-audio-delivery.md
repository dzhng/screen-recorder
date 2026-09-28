# 11a — Shared source and project PCM delivery

Status: not started. Dependencies: [08](./08-audio-mixing.md), [09](./09-first-preview.md), [10b](./10b-source-acquisition.md).

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

## Failure boundary and discretion

If inspection and preview disagree, fix their shared owner. Do not normalize levels,
trim gaps or alter timestamps solely to make an inspection fixture pass.

Delegated: sink/stream integration and bounded artifact scheduling. Source binding,
sample counts, channel reporting and tap scope are fixed. Record verification and
remaining limits in Status and the README pickup.
