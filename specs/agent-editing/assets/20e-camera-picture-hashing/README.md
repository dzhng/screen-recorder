# Camera publication picture hashing

The camera publisher verifies every decoded raw and canonical picture before
publishing. The picture digest includes exact timestamps, dimensions and visible
BGRA bytes; allocator padding is excluded. The existing private digest owner now
passes locked buffer views directly to CryptoKit. Contiguous visible rows share one
update; padded rows retain their separate visible-byte views. This removes row
copies without weakening verification or introducing another digest owner.

Two controlled offline runs per variant average **27.355s → 23.970s** for
publication, about **12.4% less time**. Hash-only timing averages25.506s →21.971s;
identities, decoding and export retain their work. These are scoped measurements
on one machine, not a latency guarantee. The candidate still exceeds ten seconds.

## Scope and evidence

[Measurements](verification.json) compare the same copied, retained camera raw,
observations and closure marker through `ProbeCameraMedia.publish`. Acquisition,
screen/camera encoder closure and physical-input drain are outside this benchmark.
The earlier [stop measurement](../20e-selected-device-probe/stop-scale/README.md)
remains separate evidence; this pass changes neither quit deadlines nor recovery,
and does not establish live shutdown or physical synchronization.

Temporary timing instrumentation in a scratch source copy identifies the input
identity reads, raw decode/hash, passthrough export, canonical decode/hash and final
identity/publication stages. The [timing patch](timing.patch) performs only clock
reads and reports; no profiling hook enters production. One early extra
whole-file equality assertion was red because AVFoundation sets export wall-clock
creation/modification dates. Its failure remains retained. A later baseline that
ran alongside compilation is retained as loaded evidence and excluded from the
controlled latency comparison.

Complete picture digests, accepted frame counts, support, diagnostics and raw/input
identities match. [Canonical comparison](canonical-normalization.json) preserves
actual full-file hashes and proves all bytes outside exactly six identified v0
MOV creation/modification date fields remain equal to the archived canonical
movie. No sample bytes, presentation times, durations or other metadata are
normalized. Production export metadata policy is unchanged.

[The evidence archive](evidence.tar.gz) retains run logs, receipts, measurements,
mutation/restoration results, fixture provenance and review/build results.
[Its manifest](manifest.json) binds each member and the immutable inputs/runtimes.
Large copied/generated movies and isolated executables stay at the external paths
and hashes in the verification. No installed app or frozen worker is replaced.

## Preservation checks

The focused native test exercises the real publisher with a tiny lossless BGRA
fixture that decodes contiguous rows and an ordinary H264 fixture that decodes
padded rows. Exact expected digests come from independently serialized decoded
picture bytes. A mutation hashing padding fails; restoration passes. The default
offline capture suite also includes these checks. Test fixtures are excluded from
SwiftPM source discovery and read from their declared repository location.

The build uses an isolated Swift scratch directory and already prepared dependency
sources. No new model preparation, downloads, inference, playback, device discovery
or live acquisition is performed. [Audited choices](choices.md) retain the buffer
and test decisions; root integrates the scoped evidence into the owning handoff.
