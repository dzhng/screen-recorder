# Public retained index delivery

The [operation registry](../../../../../packages/protocol/src/operations.ts) owns the
metadata, coverage, retry and selected-image operations. IndexProcessing resolves
references through queue publication and binds continuations to recording, revision,
generation and coverage filters. Editing the current revision does not move an
existing page or image reference. Separate metadata listing avoids embedding hundreds
of images in one tool response.

Retained images use the same bounded delivery leases as cached frames/audio. The
read owner supplies acquisition/release; delivery checks capacity before opening a
handle. CLI/MCP consume selected-image batches using ordinals, while arbitrary-frame
batches retain their requested timestamps. Neither adapter aliases one coordinate to
the other. Duplicate requests preserve their order and errors remain per item.

## Verification

- Full core: 200 tests. Protocol: 10. Service: 59. CLI: 19. Workspace build/types
  and focused lint/format pass on this host.
- Core tests reject unpublished or mismatched generation references, preserve an
  old page through a current edit, bind coverage filters and return actual retained
  file bytes. Removing revision continuation validation made its regression fail;
  restoring it returned green.
- The [bundled test](../../../../../apps/macos/tests/index-inspection.test.mjs) creates a
  twelve-second generated static source with outside cursor evidence. The actual
  native worker creates two retained PNGs. CLI output and MCP image content equal
  the service bytes. An edited current revision leaves old paging intact. A batch
  isolates an invalid ordinal while preserving duplicate successful items.
- After stopping the owned app, the test shrinks the disposable cache budget and
  verifies zero remaining cache entries. Restart preserves the original index
  generation, metadata and exact selected bytes. Original video hash is unchanged;
  owned processes are reaped.
- Shared delivery's admission and read-failure cleanup mutations fail their focused
  tests. Adapter tests also cover metadata-only results and output-write failures.
- Initial independent review identified the not-yet-integrated CLI/MCP dispatch;
  merging the adapter pass and rerunning the native test resolved it. Follow-up
  review found no actionable defect. Its socket checks were sandbox-limited;
  the host service, CLI and bundled tests above supplied the actual integration proof.

## Remaining gates

This static generated fixture proves transport, publication and retention, not
selection usefulness, physical pointing, visual readability or model understanding.
lab:index/contact sheets, dense animation behavior, thirty-minute index work/storage/
RSS and foreground latency remain requirements in 11c. The full product's speech,
physical capture and edited export gates remain unchanged.
