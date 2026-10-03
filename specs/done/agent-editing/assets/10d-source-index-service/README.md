# Source index service integration

The project service routes selected-source index requests to the shared index
producer and serves retained PNGs through the existing derivative delivery leases.
Scene generations stay retained while unfinished index recipes reference them.
Recording/package requests remain routed by the recording service until cutover;
source requests do not fabricate recording identities.

The same operation schemas advertise flat asset/stream selectors to CLI and MCP.
The schema alternatives remain individually visible in generated help. Index frame
batches preserve request order and isolate each ordinal’s delivery failure.

Root verification on 2026-09-28:

- CLI/service builds and their type checks passed.
- `bunx vitest run apps/cli/src/main.test.ts apps/service/src/project-service.test.ts --maxWorkers=2`: 23 passed. These preserve existing public adapters and service behavior; they do not alone establish native source-index acceptance.
- `bunx vitest run packages/core/src/source-index-processing.test.ts packages/core/src/source-index-selection.test.ts packages/core/src/index-processing.test.ts --maxWorkers=3`: 24 passed on the integrated producer.
- Independent review found no actionable defects and passed type checks. Its runtime tests could not bind Unix sockets inside its sandbox; the unrestricted root test invocation above owns runtime evidence. Local review log: `/tmp/screenrec-source-index-service-review.txt`.

A real native CLI/MCP source-index journey remains the next gate, including paged
coverage, delivered images, retry, history and restart. Project index projection
and project-cut semantics remain open. No listening or new geometry is accepted
by this integration checkpoint.

## Batch adapter correction

The actual native journey caught a missing source variant in the CLI/MCP batch
response parser: single images succeeded, but source `index.frames` deliveries
were rejected. Both frame and index batches now share the source-target response
shape. The existing partial-failure, lease-draining and output-preservation test
runs for source index batches as well. All 14 CLI tests pass. Independent review
found no actionable defects and passed types; its socket tests were sandbox
blocked. Review log: `/tmp/screenrec-source-index-batch-review.txt`.
