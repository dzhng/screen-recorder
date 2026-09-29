# Descriptor metadata availability

The production repair declares already-present regular-file data with Apple's
`isEntireLengthAvailableOnDemand` property. It preserves the existing descriptor
loader, precise timing, content-type detection, positional reads, cancellation,
truthful completion, size checks, and 64 MiB inspection budget. No pathname,
clone, cache, direct-FD URL, or alternative decoder is introduced.

Matched scratch controls preserve complete selected PCM, precise duration,
track range, segment mapping, format, and caller/owned descriptor offsets after
unlinking the source name. WAV, AAC, CAF and MOV pass. Request traces show small
header/box reads instead of speculative whole-resource prefix loading. Apple's
[public contract](https://developer.apple.com/documentation/avfoundation/avassetresourceloadingcontentinformationrequest/isentirelengthavailableondemand?language=objc)
explicitly describes custom schemes backed by local files; the installed SDK
`AVAssetResourceLoader.h` contains the same contract.

## Actual production measurements

The native composition window at second 59 of the 60-second WAV reads 200,326 bytes,
including 8,318 header bytes and 192,008 bytes from the physical one-second tail.
The retired 128 KiB target was incorrect for that unchanged reader: its AVAssetReader
range ends at infinity, permitting read-ahead beyond selected PCM. The reviewed
fixture bound is the physical tail plus 64 KiB metadata allowance, not a changed
product budget. `rejected-128k-report.json` retains that failed assumption.

The existing 3,000-second AAC marker's late 20 ms window reads 579,922 bytes, largely
its 562,504-byte sample table. It decodes 8,192 native frames and preserves every
selected sample in this run under the unchanged AAC numerical oracle.

A sparse two-hour Float32 WAV has 2,764,800,044 logical bytes but only 81,920 allocated
bytes. Only the header and known 20 ms markers at seconds 1, 3600 and 7199 are written.
The test never hashes, copies, or fully renders the logical file and unlinks it
on success or failure. Initial reads were 1,544,332 bytes early and middle and
392,332 near the end, with 8,192 decoded frames and exact marker PCM throughout.
`report.json` retains that complete 16-case measurement and its release worker hash.

**Read-ahead remains open.** A later early-window read consumed 1,609,868 bytes,
one extra 64 KiB chunk, exceeding the proposed four-second payload plus 64 KiB bound.
`sparse-read-ahead-red.json` and its log retain the actual failure. The default harness requires accounting/metadata and reports read-ahead separately;
`--enforce-read-ahead` makes that still-open bound fail the exit status. A later
green observation does not erase the retained red. The metadata
repair does not establish an optimal/general decoder read-ahead bound; the
finite-reader-end owner must resolve this gate without weakening it.

## Evidence and verification

`evidence.tar.xz` contains the complete successful measured requests, sources and
outputs, except the deliberately sparse source reconstructed by the harness.
`media-hashes.json` checks every archived file. `research.tar.xz` contains the
standalone probe, copied loader, syscall interposer, request traces, comparisons
and generated small AIFF. The interposer filters by pinned device/inode and
observes logical pread/read/mmap traffic, not physical disk activity. It is
research code only. Production instrumentation remains the 24n owner.

The exact declaration-off mutation fails the physical-tail+metadata gate; its
report is retained. All five native descriptor/composition/retained-PCM tests
pass, including the original 64 MiB refusal without partial publication. The
SourceAudio owner also passes inspection/streaming counters and preservation.

Independent review approved the production seam and found one harness cleanup
issue: initialization errors escaped unlink. Initialization and verification now
share the cleanup scope. An injected ENOSPC during the first sparse-header write
fails as intended and leaves no sparse file. The review and fault script/log
are retained. Final closeout review reports no remaining actionable findings.
The remaining read-ahead red is separate from this cleanup fix.

## Explicit inherited format gap

MP3, AIFF and FLAC fail the descriptor loader before and after this declaration
with AVFoundation −11829 / OSStatus −12848. Existing pathname codec support does not
establish public descriptor import support. Matched outputs and source hashes
are retained in `research.tar.xz` (`ondemand.json`); the separate format-identification
owner must prove public import→inspection rather than silently declaring support.

Direct `/dev/fd` URLs with an explicit public MIME override worked for tested
formats but bypass the 64 MiB loader guard and require correct MIME provenance.
That candidate was rejected. Disabling precise timing did not establish a byte
bound and can alter timing guarantees. Neither alternative ships.
