# Finite decoder demand

The unchanged sparse read-ahead gate now passes at early, middle and end positions.
Each 20 ms selection from the two-hour logical Float32 WAV reads 16,020 descriptor
bytes and decodes 963 native frames: 960 selected, two existing lookbehind frames,
and one endpoint rounding cell. Every selected sample equals the authored marker.
The former infinite reader deterministically fails the derived PCM frame bound;
the earlier variable multi-megabyte read-ahead failure remains preserved in
[24o](../24o-descriptor-metadata/README.md).

The final release run passes all 16 accounting/metadata cases with
`--enforce-read-ahead` and peaks at 37,371,904 worker resident bytes. The ordinary
60-second PCM source now reads 12,170 bytes for its late window. AAC still needs
its source sample table: its selected window reads 579,922 bytes and decodes
3,009 frames. Descriptor bytes, decoded sample payload, output bytes and physical
disk activity remain different quantities; this is not a generalized codec I/O
or whole-parent scale claim.

## Why this is the existing owner's bound

ConvertedAudioInterval already computes the native demand from exact owed-frame
arithmetic, converter context and retained support. Capture materialization
already supplies its accepted native count. The reader uses that exclusive end
instead of an infinite range, with the existing interior-cell time representation
and checked finite subtraction. The selected-frame clamp discards the possible
endpoint sample before conversion. No guessed time padding, packet-policy,
arithmetic, MIME, processing identity or cache-identity changes are introduced.

AVAssetReader's SDK contract forbids changing timeRange after reading starts.
The reader therefore tracks installed coverage separately from the current
selection. Later selections consume reusable pending PCM, then open another
finite reader only when coverage is exhausted. Normal extension does not consume
the separate one-time premature-tail retry. Empty requests leave the physical
reader origin untouched.

## Preservation and failure controls

Source controls pass in release and debug, including arbitrary fractional
physical origins, unavailable gaps, excluded impulses, mono/stereo and unsupported
formats. Contiguous, overlapping, empty, backwards and gapped demands match every
reference sample. Shared contiguous demand decodes 203 frames versus 204 with
independent readers, demonstrating reuse of pending PCM. Empty requests naming a
different origin preserve both return-to-old and change-to-new source addressing.

The short physical-EOF probe returns only real samples, retries once per separate
demand, and does not loop or invent silence after a later request. The retained
scratch trace records normal extension separately from that retry; trace writes
were removed from production before final verification.

Three matched real AAC baseline/candidate comparisons are byte exact: a complete
two-second 44.1 kHz source, the last two seconds of the existing 3,000-second
marker, and its last 20 ms. **These valid AAC cases did not execute the positive
premature-tail retry.** The synthetic short-EOF case proves bounded failure/retry
behavior separately; no claim closes every possible AAC recovery case or any
older cross-invocation numerical diagnostic.

Five native wire/descriptor tests pass, including AAC terminal packet windows,
truncated-source refusal, inherited-handle preservation and the original 64 MiB
rejection without partial publication. The complete music/replacement gate passes
AIFF/ALAC/AAC/MP3 mixing, fractional trims, splits, resampling, gain, missing support,
cancellation and bounded block delivery. The prerecorded native capture publication
probe preserves canonical PCM and shared support with both roles, interruption,
and missing/torn terminal records.

The release capture-test executable hit a Swift optimizer ownership assertion in
the unchanged terminal-boundary test function before execution. Its debug build
and prerecorded probe pass. The production release worker builds successfully;
no compiler-workaround source change was made. The failed build log is retained.

## Evidence

`report.json`, `evidence.tar.xz` and `media-hashes.json` retain the actual worker
receipts, requests, complete media and hashes. The sparse source is reconstructed
by the harness and removed without hashing/copying its logical holes.
`aac-parity.tar.xz` and `aac-pcm-comparison.json` retain matched AAC outputs and the
small additional input; the long marker is in the main evidence archive.
`capture-publication.tar.xz` contains the prerecorded materializer/publication proof.
`verification.json` records worker identities and verification boundaries.

Independent review found no actionable defects in finite endpoint arithmetic,
coverage extension, reuse, empty-origin handling or retry. Shape review keeps
coverage state in AudioSourceReader and strengthens the existing probes instead
of adding another scheduler or decoder. All scratch trace instrumentation is
excluded from production; its patch/log remains evidence.

## Combined root preservation

The combined 24p/24q debug worker passes all 16 enforced decoder/metadata controls,
five native descriptor tests, the SourceAudio owner, 31 core audio/preparation
tests, five-format public import/inspection preservation and 50 public denoise
checks. Sparse marker reads remain 16,020 bytes, the late 60s WAV reads 12,170 bytes,
and the retained AAC numerical comparison is exact in this run. No processing
recipe or sampling tolerance changes.

`root-verification.json` records the exact combined worker and compact outcomes.
`root-media.json` maps all 151 complete files to verified archive members. It
reuses 218,513,946 bytes already retained byte-identically in the denoise and
finite-demand archives; `root-evidence.tar.xz` holds only 28 new members. Every
referenced member and new archive member was rehashed against the actual root
files. This preserves complete evidence without copying identical media again.
Build, source, descriptor, core and public logs are compressed alongside it.
