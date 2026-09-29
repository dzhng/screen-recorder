# 24p — Inherited audio container identification

Status: implemented and verified. Dependency: descriptor media input.

## Contract

An inherited regular-file handle must retain the container identity needed by
AVFoundation without reopening a pathname. The old MOV fallback refused supported
audio such as AIFF and MP3. Ordinary managed-asset imports already use pathname
inputs; their public journey is a preservation gate, not the reproduced defect.

Keep classification separate from decoding. Cheap signatures route known containers;
AudioToolbox identifies ambiguous ID3 or MPEG-sync candidates through bounded
positional callbacks. ID3 does not establish MP3. Existing SourceTrack packet,
rate and channel admission continues to decide which identified audio can be read.
Neither successful probing nor a generated FLAC sample establishes format-wide support.

Header sniffing, platform identification and AVFoundation delivery share the
existing 64 MiB logical inspection ceiling. Streaming delivery remains unrestricted,
but identification still has a finite 64 MiB ceiling including its header. Reads
preserve the caller's offset and use the owned descriptor after close/unlink.
Malformed candidates fail without publishing partial audio. Existing WAV/CAF and
MOV/M4A routing remains intact.

## Gate

The native [descriptor tests](../../../helpers/mac/Tests/descriptor-media.test.mjs)
compare selected PCM with same-worker pathname controls after unlinking sources,
including bare MP3 and ID3-prefixed non-MP3 audio. The original worker must fail the
inherited AIFF case. The [source audio tests](../../../helpers/mac/Tests/SourceAudio/main.swift)
exercise the platform parser's exact remaining allowance, refusal one byte short,
and retained-handle lifetime; an allowance-bypass mutant must fail.

The [public journey](../../../packages/test-harness/editing/audio-format-admission.mjs)
imports prerecorded assets over MCP and retrieves selected audio over CLI, comparing
PCM exactly with pathname controls. This preserves the existing public contract.
[Retained evidence](../assets/24p-audio-format-admission/README.md) distinguishes
these boundaries and records limitations.
