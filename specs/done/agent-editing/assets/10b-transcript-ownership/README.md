# Transcript ownership preservation

The raw transcript validator, indexes, bounded reclamation and retained engine
bytes have one owner: `TranscriptStore`. Its catalog namespace follows the real
recording or asset owner. The caller supplies source identity and validates its
lifetime before ingestion and again before publication. A selected asset records
its stream, acquisition context and support digest independently of recording
narration metadata. Negative normalization offsets remain valid.

Recording and portable-package boundaries retain their actual recording contract;
no asset creates a recording row. The package reader remains recording-specific
until the project portability slice. Catalog format 7 refuses older table shapes.

## Evidence

- `core-tests.txt`: 22 passing focused tests, including all 306 retained native
  words, source ranges and raw bytes; owner namespace collision, cancellation,
  authority races and restart reclamation.
- `authority-mutation-red.txt`: removing the final authority check makes all three
  changed-authority cases incorrectly publish. The restored check passes.
- `service-tests.txt`: 17 passing recording service, deletion and package-guide
  checks, including actual child-process transcript reads/search/retry.
- `package-preservation.txt`: three actual native publication/reopen journeys
  preserve transcript queries, pinned generations and model readiness. Speech in
  this harness is generated fixture output, not fresh native inference. Native
  executable was the frozen `/tmp/screenrec-native-before-selected-stream-5872b56`.
- Core/protocol/service builds and core/service type checks passed; changed code
  passes formatting/lint and `git diff --check`.

The independent CLI review found stale deletion-fixture SQL and the renamed source
interval diagnostic expectation. Both were reproduced and corrected. Broader
service verification also found an inherited request assertion still requiring a
narration role; the assertion now follows the role-free native selection contract.
The original red logs are retained. The first service run also lacked its local
build output; building the service resolved that setup failure.

This proves the shared store and recording/package preservation, not public asset
transcription admission, source paging/search, new inference or listening quality.
Those remain in the enclosing source-acquisition slice.
