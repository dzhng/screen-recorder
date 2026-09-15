# CLI and MCP adapters

The adapters format the same service operations for JSON command-line calls and MCP
stdio. Parameter schemas and help come from the protocol declaration; edits and
catalog behavior stay in the service/core. An adapter never edits the database.

After building, run `bun run screenrec --help` from the repository. The help lists
implemented operations and their JSON schemas without connecting to the app.
`--params -` reads bounded JSON from stdin. Edit timestamps are integer microseconds
in the named revision's playback coordinates, with half-open ranges.

Use a stable mutation `params.requestId` and the same arguments when retrying an
uncertain write. `--id` identifies the transport request; it is separate from that
durable mutation identity. Operation failures retain the structured error and exit
nonzero; command-line usage errors go to stderr. MCP keeps stdout for protocol
messages and marks operation failures with `isError`.

Connection selection currently uses explicit `--socket PATH`. Automatic personal-app
discovery is still pending in the client integration. Media operations must add
actual MCP image/audio content when implemented; a returned file path is not an
image-delivery implementation.
