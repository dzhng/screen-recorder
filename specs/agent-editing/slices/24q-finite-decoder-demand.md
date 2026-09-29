# 24q — Bound native readers by exact decoder demand

Status: verified in [evidence](../assets/24q-finite-decoder-demand/README.md), including combined root preservation with 24p. Dependencies: [24o](24o-descriptor-metadata.md).
Root owns parent24 and choices integration. Preserve the [24o read-ahead red](../assets/24o-descriptor-metadata/README.md).

## Contract and owner

AudioSourceReader opens an AVAssetReader range ending at the native exclusive end
already supplied by its caller. ConvertedAudioInterval derives this from exact
owed-frame arithmetic, converter context and retained-run bounds; capture
materialization supplies its exact accepted count. Do not add guessed seconds,
change packet context, or change sampling/conversion/cache identities.

Use the existing interior-sample-cell time representation at both endpoints,
with checked finite duration subtraction. The endpoint may decode one rounding
cell beyond demand, but the existing selected-frame clamp excludes it before
conversion. Preserve the two-packet lookbehind and exact physical origin.

A later begin reuses pending PCM. When its demand extends beyond exhausted finite
coverage, reopen at the next demanded native frame; normal extension is distinct
from the existing one-time premature-tail retry. Empty demands do not open a
reader or overwrite its physical origin. No-progress EOF never pads or loops.

## Verification

Keep complete source, fractional-phase, availability, poison, native wire,
codec/rate/mixing and prerecorded capture-materializer controls green. Compare
matched baseline/candidate AAC full and tail PCM under the existing oracle;
separately exercise retry/no-padding behavior with an early physical EOF.

Pin contiguous, overlapping, empty, backwards and gapped demands, including empty
requests naming another origin. Show pending PCM is reused by comparing actual
decoded work with independent readers. The late PCM fixture must decode no more
than selected frames plus two lookbehind frames and one endpoint cell; the old
infinite reader must fail that derived bound.

The unchanged sparse two-hour early/middle/end read-ahead gate must pass without
increasing its threshold. Retain actual descriptor reads, decoded frames,
complete marker PCM, worker RSS, hashes, and the original failed evidence. Do not
copy/render the whole sparse file or infer generalized codec/physical-disk bounds.

SDK basis: AVAssetReader.h states timeRange controls the temporal region read and
cannot change after startReading; therefore coverage extension opens a new reader
only after reusable pending data is exhausted.
