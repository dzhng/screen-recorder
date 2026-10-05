# CLI and MCP adapters

The CLI is the primary external-agent adapter, paired with the
[consumer skill](../../skills/screenrec/SKILL.md). It formats
[service operations](../service/README.md) as JSON command-line calls; optional
MCP stdio exposes the same contracts. The [protocol declaration](../../packages/protocol/README.md)
owns schemas and help; adapters never edit the catalog or infer another operation.
[Builds and installation](../../scripts/README.md) own checkout and installed launchers.
The released launcher’s media-tool passthrough uses each tool's CLI and output
contract, separately from service operations; the build guide owns its update exclusion.

## Discover the contract before executing

Help exposes complete operation schemas without launching the app. A schema is
self-contained: retain its local definitions when selecting one operation instead
of copying a fragment. Arguments, stdin handling and mode selection belong to the
[entry point](src/main.ts). The [composition time contract](../../packages/composition/README.md#exact-clocks)
explains why media coordinates and structural commands have different admission.

[Client discovery](../../packages/client/README.md) owns app launch, selected home,
deadlines and cancellation. Explicit socket selection connects directly; ordinary
app launch prepares a service rather than starting a recording.

## Preserve answers and uncertainty

Keep durable mutation identity separate from transport correlation. A failed or
interrupted exchange cannot prove the operation did not commit. The adapter sends
an operation once and never replays it to recover a large response.

CLI operation replies use one JSON envelope; MCP stdout carries only protocol
messages and diagnostics belong on stderr. Before parsing establishes a mode,
usage failures cannot safely be written as a CLI response. Structured operation
failures retain their code and retry meaning across both adapters.

Small MCP results retain complete text and structured data. Large results use a
service-owned lease for the complete encoded response. Verify chunk identity,
length and digest before decoding, then close the lease. Nested media has its own
lifetime; renewing the response does not revive expired media or undo a mutation.
Recover uncertain writes only through their advertised exact-request replay.

Media delivery provides actual image/audio content or an explicitly requested
output file. Batch consumption retains the service's revision, tap and generation,
including pending metadata and partial failures. A pathname alone is not MCP media
attachment proof. The [delivery owner](src/artifact-delivery.ts) defines consumption;
[installed acceptance](../../specs/done/agent-editing/release-closeout.md) records
what was actually exercised through the packaged app.
