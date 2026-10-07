The bounded transcript implementation has a cursor pinning defect, and several existing native and public consumers still use the pre-cutover contracts. These issues break paginated bounded reads and established speech verification paths.

Full review comments:

- [P1] Carry source-generation pins into cursor continuations — /Users/server/dev/yap-capability-skill/packages/core/src/project-evidence.ts:225-231
  When a project transcript request uses `sourceGenerations` and then continues with only the returned cursor, `read()` rebuilds the page plan without restoring those selectors from the manifest. The query digest and dependency pins then differ from the original request, so the second page fails with `ARTIFACT_CHANGED` instead of reading the bounded generation.

- [P1] Migrate readers to explicit transcript preparation — /Users/server/dev/yap-capability-skill/packages/protocol/src/operations.ts:711-717
  This removes `prepare` from `transcript.get`, but existing consumers such as `packages/test-harness/editing/source-evidence.mjs` and the service project tests still use `transcript.get` to start inference and wait for its job. They now receive `not_requested` with no job and will time out or dereference an undefined job; migrate those callers to invoke `transcript.prepare` before landing the contract cutover.

- [P1] Add execution to direct speech-wire callers — /Users/server/dev/yap-capability-skill/helpers/mac/Sources/YapWire/SpeechOperation.swift:10-15
  Making `execution` mandatory in the native request breaks the existing direct callers in `helpers/mac/Tests/speech.test.mjs` and `helpers/mac/Tests/speech-lab.mjs`, whose `speech.transcribe` params contain only models, track, and output. `WireRequest.decode` will reject these requests before transcription, so the native speech test product and lab no longer run.

- [P2] Require ownership in every raw transcript line — /Users/server/dev/yap-capability-skill/packages/core/src/transcript.ts:320-323
  The receipt now requires `owned`, but the raw-line schema makes it optional and ingestion only compares it when present. A producer or imported package can therefore omit ownership from raw evidence while publishing a receipt and indexed rows that claim ownership, leaving the retained raw artifact inconsistent with its receipt.