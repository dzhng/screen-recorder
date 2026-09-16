# Native source timing evidence

The native exporter reads the trusted journal prefix once. Completed pauses and
coalesced audio acquisition intervals accompany cursor/geometry/display evidence;
unfinished pauses retain only their observed host timestamp. Recovery and export
share the same audio merge owner, including the existing one-microsecond rounding
seam. The stream holds one pending interval per audio role; callback summaries do
not accumulate timing arrays.

## Verification

- `swift build --package-path helpers/mac --product screenrec-native` passed.
- `swift build --package-path apps/macos` passed with the renamed stream consumer.
- `node --test helpers/mac/Tests/source-evidence.test.mjs` passed all ten tests,
  including interleaved roles/gaps, completed and unfinished pauses, malformed and
  incomplete tails, 120,000 cursor samples, output/source protections and budgets.
- The measured 100,000-gap worker run peaked at 23,445,504 bytes RSS and returned
  a receipt below 2 KiB. Before per-record autorelease drainage, that same test
  failed at 494,206,976 bytes RSS. This is measured bounded behavior for that
  workload, not a benchmark for every recording length.
- `swift run --package-path helpers/mac ScreenRecorderCaptureTests` passed,
  including stream/recovery timing equivalence and empty streaming timing arrays.

## Review and integration

Shape review removed the cursor-only naming and moved both summary accumulation
and streaming through one coalescing pass. Diff review preserved exclusive output
publication and the trusted-prefix boundary. Documentation now distinguishes the
recovery summary's timing arrays from the streaming receipt.

Independent `codex review --uncommitted` found two required integration changes:
the service must call `media.sourceEvidence`, and the TypeScript index must accept
and count pause/audio records. Those are owned by the parent integration pass and
must land together with this native commit. The review's native build was blocked
by its sandbox; the builds and executions above ran outside that sandbox.

### Decision handoff

**Sound, high confidence:** normalized audio intervals are emitted when a per-role
gap or EOF proves their end. For example, narration can span cursor observations
that are emitted before that audio interval. Consumers therefore index explicit
timestamps instead of interpreting file order as global chronology. This was
unspecified in the export format; buffering and sorting all events would defeat
bounded streaming. Cursor/geometry relative journal order remains intact.

**Sound, high confidence:** malformed audio roles, negative timing and empty audio
intervals end the trusted prefix rather than expanding the stream's role set or
publishing unusable timing. Capture writes only narration and system roles; the
bounded pending interval state and downstream audio selection share that scope.
