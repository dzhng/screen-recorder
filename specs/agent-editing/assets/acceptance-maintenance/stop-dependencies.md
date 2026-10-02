# Camera publication dependency audit

Read-only source audit at its original baseline after MCP media integration.
The later [20f implementation](../../slices/20f-camera-publication-overlap.md)
adds scoped scheduling preservation and a genuine qualified interrupted-prefix
case. The [retained metadata predicate](../20f-camera-publication-overlap/retained-eligibility/README.md)
passes without publication; actual full-take overlap, resources and performance
adoption remain open.
This audit itself performed no build or runtime measurement. The ten-second completed-stop requirement remains
failed; this is a prospective scheduling seam, not an accepted optimization.

The [publication owner](../../../../helpers/mac/Sources/ScreenRecorderCapture/CameraMedia.swift)
at that baseline scans raw pictures, exports their physically established support, then
scans the canonical candidate. Each digest includes exact ordered timestamps,
dimensions and every visible BGRA byte. Preserve that representation and the
[existing component measurements](../20e-camera-digest-components/README.md).
Independent per-frame hashes would change the digest; buffering the whole raw
picture stream would require an excessive working set.

There is a different possible dependency break. Retained observations own the
accepted picture mappings. The closure marker binds completed writer bytes but
does not prove physical decoding. A streamed mapping and occupied native sample
inventory could establish an **intended** support interval before either BGRA
scan. The [native sample timing owner](../../../../helpers/mac/Sources/ScreenRecorderMedia/SampleTiming.swift)
already supplies the last sample's end to the existing picture reader. Use the
first mapped start and the lesser of the final mapped nominal end and native
mapped sample end; asset duration, callback cadence and journal completion cannot
substitute for these facts.

For a narrowly qualified closed case, private passthrough export could precede
two concurrent complete scans, each retaining its own existing sequential digest.
Working memory would hold the two reader pipelines and bounded mapping buffers,
not all pictures or an array of frame hashes. Actual decoder-pool memory remains
unmeasured. Qualification is not physical acceptance: both complete scans must
settle before a receipt or public file can be committed.

## Preconditions and failure ownership

Qualification would require matching closure/input identities, complete untorn
mapping, exact increasing mapped timestamps, complete occupied native inventory
with matching count/order, and representable intended support. Unsupported layouts
and uncertain or malformed qualification return to the current raw-first path;
caller cancellation propagates. Raising a later mapping error during qualification
could otherwise hide an earlier raw timestamp error.

Actual raw count, support and diagnostics must agree with qualification before the
speculative canonical candidate can be used. A short physical prefix, premature
completed EOF or late decoder failure retains the existing prefix path and its
diagnostics. The intended full interval must never become the receipt for an
actually shorter decode. Raw validation owns error precedence; the first task to
throw cannot select the public outcome.

Any prospective implementation must preserve these complete outcomes:

- Native holds, fractional terminal clipping, picture order and full digest.
- Missing accepted pictures, premature EOF, `acceptedBeyondPhysicalEOF`, usable
  interrupted prefixes and `rawDecodeInterrupted`.
- Unmapped tails, torn mappings, interior timestamp mismatches and malformed
  later rows, including raw-first refusal precedence.
- Changed raw/observation/mapping/marker/journal identities, canonical pixel/count/
  timestamp/support mismatch, cancellation, conflict and recovery continuation.
- Closed-source lifetime and a single terminal append, with no public replacement
  or receipt from a speculative failed candidate.

## Evidence needed before adoption

First prove the complete compact preservation matrix against the current owner,
including fault ordering and generic partial-prefix fallback. Only a materially
changed candidate that earns those checks justifies another bounded retained-file
publication measurement. Keep the frozen worker and accepted cohort unchanged.
Record actual peak memory and every published picture/support/digest value; do
not turn a prefix or estimated ideal overlap into full-stop evidence.

Both scans still process approximately 73.455 GB of visible pixels on the retained
take. The saved roughly 10.8-second digest time per stream means ideal overlap
alone does not establish the ten-second stop target. Additional work remains even
if scheduling parity is proved. No production strategy is selected by this audit.

## Critical-path follow-up

A fresh read-only trace after metadata eligibility found no duplicated full
verification in ordinary finalization: native stop publishes camera media, then
source publication wraps journal/member identities. Physical re-verification in
reuse and recovery has a different purpose and must remain. The existing
[component measurements](../20e-camera-digest-components/README.md) still rule out
copy/lock coalescing, equivalent hash providers and build mode as supported fixes.

Comparing two complete decoded streams while hashing only one would change the
required verification traversal and still retains the saved single-hash cost
above ten seconds. It is not selected. Moving verification into capture would
require a new growing-file/timing/backlog/recovery contract; fragmented output
alone does not prove that contract, and pre-encoding pixels cannot substitute for
lossy decoded pixels. No such architecture is selected by the scheduling pass.

Another implementation needs a concrete way to remove or move critical-path work
while preserving both ordered digests. Its first proof belongs on the tiny existing
fixtures, including interruption/cancellation/recovery, before a full retained-take
run. No new benchmark or relaxed deadline follows from this audit.

## Native fragment feasibility

SDK inspection distinguishes two mechanisms. `AVAssetWriterDelegate` segment data
is not an observer on the current MOV writer: it requires the content-type
initializer, suppresses ordinary file writing and ignores `movieFragmentInterval`.
The streaming MPEG-4 profiles can also force sync samples. Substituting that route
would change writer/container ownership and potentially encoding; it is not selected.
See the [segment-writing explanation](https://developer.apple.com/videos/play/wwdc2020/10011/)
and the installed SDK's `AVAssetWriter.h` delegate contract.

[AVFragmentedAsset](https://developer.apple.com/documentation/avfoundation/avfragmentedasset)
and its minder instead support inspection of appended QuickTime fragments.
That is a possible raw-reader seam, not proof of stable decoded-picture meaning.
Normal closure can defragment the file, and segment summaries do not establish
complete presentation order or BGRA values. A tiny prerecorded prefix-versus-closed
comparison must establish those facts before any incremental implementation.

The canonical traversal has a separate dependency: its physical MOV is created
by bounded passthrough export after closure. Reading raw fragments twice cannot
verify that file. An already-reading mutable composition cannot be extended safely;
the SDK reader contract declares such mutation undefined. A successful raw-prefix
test would resolve only the first traversal's feasibility, leaving canonical
production, complete ordered digests, tail/backlog, recovery and stop performance
unproved. No encoding, digest or deadline change is selected.

Two further source-only candidates remain unselected. Separately exported prefix
pieces cannot transfer their decoded acceptance to a new assembled MOV without
settling dependency closure, presentation/endpoints and format/color semantics;
encoded payload and PTS equality is insufficient. The current final-candidate
decoded scan remains binding.

A sealed raw MOV that already meets every canonical physical constraint could
in principle supply canonical content without export. A growing hardlink would
still need prefix-to-closed stability and exact support equality, which is stricter
than the scheduling predicate. It also changes the output owner's no-source-alias
assumption, fault isolation, container identity and link lifetime before admission.
No such ownership or identity change is selected. If pursued, describe two decoded
verifications of one shared representation truthfully; the extra name is not an
independently fabricated movie. Neither candidate establishes the stop deadline.

## Prefix-boundary qualification

[20g physical evidence](../20g-camera-raw-prefix/physical-continuation/README.md)
does not support adopting a one-picture uncommitted tail. One ordinary prefix
survives; the separate candidate reports a mismatch before intentional interruption.
The failed later operands were not saved, so no changed field or cause is assigned.

A boundary needs complete storage, decoder dependency/reordering closure and
stable presentation mapping/endpoints independently. The SDK's `AVSampleCursor.h`
defines `sampleIsFullSync` as an actual decoder refresh sample. A configured maximum
keyframe interval or a complete fragment is not that observation. Dependency flags
can be unknown, and zero `samplesRequiredForDecoderRefresh` can mean information
is absent. Reordering queries require cursors from the same track instance.
The native `assetEnd` owner also clips to the current segment boundary; a decoded
pixel boundary alone cannot establish final presentation support.

No current API certifies that all prior decoded tuples survive append and closure.
Before considering a dependency-based candidate, preserve both complete operands,
failed media and actual sync/dependency, DTS/PTS, storage and segment facts.
Preparation of that observer does not authorize replaying the failed tail rule,
incremental adoption or a new performance measurement.

The [closed native inventory](../20g-camera-raw-prefix/native-cursor-qualification/README.md)
now exposes actual refresh samples and reordering. Both self-boundary “may” queries
are true at every refresh sample, so these answers supply no safe-prefix certificate.
All interior owner endpoints equal the next presentation timestamp in this fixture;
no timing correction is justified from it. A codec-defined bound would need its
own dependency, storage and endpoint argument before a new physical candidate.
