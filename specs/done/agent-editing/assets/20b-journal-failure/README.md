# Accepted media survives journal failure

The production writer must remember successful media acceptance before attempting
journal writes. Otherwise a first journal failure leaves the track count at zero
and finalization cancels a writer that already accepted audio. This correction
retains bytes for recovery; it does not turn unjournaled audio into acquired support.

The offline `runCaptureJournalFailureProbe` in the existing capture test executable
feeds prerecorded video/audio through the actual callback and writer. No capture is
started and no device enumeration or permission prompt occurs. A large but valid
header keeps the journal above the tiny media file sizes. The isolated test process
lowers only its soft file-size limit at each first audio journal boundary; it restores
the limit and signal handler before finalization. The hard limit stays unchanged.
Actual EFBIG and file-size receipts distinguish a journal failure from media failure.
The healthy control determines the real track-start record length.

Retained red is the corrected mechanism-control run: accepted count zero after
EFBIG. Earlier mechanism attempts were not product evidence. Green covers healthy,
track-start failure and acquisition-record failure. Both failures report
JOURNAL_FAILED; accepted first/end remain100000/270667us. Native decoding from the
actual100000us media start returns8192mono float PCM frames byte-identical to the
source fixture. Recovery decodes retained audio but reports no acquired intervals.
This is process/write-error evidence, not power-loss durability or schema2 approval.

Reproduce from repository root with a fresh output directory:

```sh
swift build --package-path helpers/mac --product ScreenRecorderCaptureTests
SCREENREC_JOURNAL_FAILURE_OUTPUT=/tmp/capture-journal-check \
SCREENREC_CAPTURE_GAP_CORPUS="$PWD/specs/agent-editing/assets/00-corpus" \
helpers/mac/.build/debug/ScreenRecorderCaptureTests
helpers/mac/.build/debug/ScreenRecorderCaptureTests
```

The failure test is opt-in because it changes process-local resource limits; the
ordinary default suite keeps its existing coverage. Raw journal/results are gzip
compressed without altering their bytes. MOV files are retained unchanged.

Review: root shape review and independent Codex read-only review found no actionable
issues. The unchanged default capture suite passed. Production change adds one
first-append Boolean and moves accepted bookkeeping; no persistent format, public
API or production failure hook is added.
