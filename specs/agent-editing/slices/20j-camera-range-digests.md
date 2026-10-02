# Resume decoded camera verification

Status: the [fixed range case](../assets/20j-camera-range-digests/README.md) passes
both independent continuing digest projections and all delivered tuples/support.
[Root saved-data review](../assets/20j-camera-range-digests/merged.json) verifies
the complete values without replay. No production digest has moved out of
finalization. [Stored samples](20k-camera-cursor-buffers.md) and
[unchanged transfer](20l-camera-cursor-transfer.md) now qualify their fixed cases;
[20m](20m-camera-continuing-verification.md) owns production integration.

## Contract

Can two independent SHA256 states consume only newly verified picture ranges,
retaining the existing CameraMedia digest representation and exact native clocks?
Set AVAssetReader.timeRange before reading each immutable file. Keep the BGRA
output and SampleTiming endpoint owner; never derive endpoints from range-clipped
buffer duration or rebase timestamps. A ranged reader does not refresh a growing
asset or establish the amount of internal decoder preroll.

## Fixed retained-file case

Use the same closed 197-picture raw source and its complete frozen tuples.
Independently use the distinct canonical copies from the
[intact-buffer case](../assets/20i-growing-canonical-feasibility/intact-buffer-candidate/README.md):
its first complete copy contains 38 decoded pictures, its later copy 158, and
its closed movie 197. Preserve every input and earlier result.

Use saved exact asset PTS at qualified IDR ordinals 29 and 145 as range boundaries:
`[0,F29)`, `[F29,F145)`, `[F145,7s)`. These fences fit both canonical active
copies; do not use the batch admission counts as decoded snapshot lengths.
The raw series reads its unchanged closed file in those three ranges; the
canonical series reads the first copy, later copy and closed movie respectively.
This tests raw seeking and canonical snapshot continuation, not live raw admission.

For each series, preserve every delivered picture and boundary-buffer fact before
comparison. Compare all concatenated PTS, digest PTS, dimensions, visible BGRA
bytes and owner-computed endpoints with its existing full traversal. Require
exact membership and order, complete reader terminals and final native support.
Continue a separate hash state through each series, hashing each committed picture
once through the exact existing digest byte sequence. Compare each checkpoint and
final digest with the same representation applied to saved reference bytes;
do not replay a complete native baseline or adopt a second production digest owner.

Observe compressed nil-settings buffers in the same ranges without writing them.
Keep complete marker, raw/output clock, attachment and indexed sample facts;
range-generated markers must not become an assumed transfer/filtering policy.

The actual ranges add reset information on the first media sample of each resumed
range and terminal markers at each range's end. Other media facts match the full
reader in this fixture, excluding buffer ordinal. This observed context difference
is why compressed transfer has a separate prerequisite.

## Bounds and decision

Review and freeze one private prototype and invocation before execution. Reuse
the warm compiler and qualified observers. Compilation is bounded to 150 seconds
total, native work to 15 seconds, the whole phase to 180 seconds, decoded output
to 400 pictures, each compressed reader to 512 buffers/400 media samples, each
bounded payload/file to 2 MiB and each stdio stream to 1 MiB. Preserve partial
facts and EOF status before refusals. Lossless compiler fixes retain rejected
attempts within the same aggregate; no semantic tuning or native retries.

A pass qualifies these fixed range and digest-state results. Compressed transfer,
live raw/canonical ownership, interruption/recovery, sustained throughput,
bounded backlog and completed-stop performance still require implementation
and their own preservation proof. No device capture or installed switch is needed.
