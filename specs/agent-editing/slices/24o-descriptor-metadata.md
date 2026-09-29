# 24o — Declare immediately available descriptor data

Status: metadata prefix correction verified; general sparse read-ahead remains
open with a retained red. See [evidence](../assets/24o-descriptor-metadata/README.md).

## Contract and owner

The descriptor loader already owns a pinned regular file whose complete initial
length can be read positionally. Declare that fact with
`isEntireLengthAvailableOnDemand`, preserving the existing descriptor lifetime,
size checks, precise timing, codec detection, request completion, cancellation,
64 MiB inspection budget and streaming policy. Do not replace its source with a
pathname, direct URL, clone, cache, or new decoder.

The public SDK documents this property specifically for custom schemes backed by
local files. Without it, AVFoundation treats the resource as progressively loaded
and can request a whole prefix while metadata is being inspected. The prior
[actual read evidence](../assets/24n-decoder-work/README.md) is the red reference.

## Verification

Freeze matched scratch request traces and complete PCM/metadata comparisons for
WAV, AAC, CAF and MOV, with the source name unlinked and caller/owned descriptor
offsets unchanged. Preserve recorded inherited MP3/AIFF/FLAC descriptor refusals;
this slice does not expand format support or change their path-based behavior.

Drive the production native composition harness: a 20 ms late selection from the
fixed 60-second WAV must read at most its physical one-second tail plus 64 KiB
of metadata allowance, and preserve full-versus-window PCM. The abandoned 128 KiB
guess was smaller than the unchanged native reader's physical read-ahead; retain
that red and its request trace. This is not a product-budget change.
Also inspect early, middle and end markers of a sparse two-hour logical WAV
without copying or fully rendering it; compare every selected PCM sample. Mutating this declaration off must
fail that gate. Keep the original 64 MiB rejection and no-partial-publication
check, descriptor identity/lifetime checks, bounded frame decoding, AAC numerical
conformance, and streaming counters green. Retain actual request ranges and byte
counts separately from output bytes and physical disk traffic.

No visual style, live capture, listening, installation or full two-hour DSP run
is part of this pass. Parent24 remains open for other scale families. Root owns
hub/choices integration.

## Research boundary

`AVURLAssetOverrideMIMETypeKey` makes direct `/dev/fd` URLs work for tested
formats, but bypasses the loader's inspection budget and requires new MIME
provenance; it is rejected here. Disabling precise timing does not establish a
read bound and can change timing guarantees. Full-copy or clone fallbacks are
unnecessary. Partial request completion and chunk-delay workarounds are invalid.

Primary contract: [Apple content-information documentation](https://developer.apple.com/documentation/avfoundation/avassetresourceloadingcontentinformationrequest/isentirelengthavailableondemand?language=objc)
and the installed SDK's `AVAssetResourceLoader.h`.

The harness reports accounting/metadata and sparse read-ahead verdicts separately.
`--enforce-read-ahead` makes the still-open four-second-payload plus64KiB bound
a failing exit gate. Never increase it to absorb the retained extra-chunk red.
The next owner must assess a finite AVAssetReader endpoint without changing
packet lookbehind, source phase, fragment reuse or complete PCM.
