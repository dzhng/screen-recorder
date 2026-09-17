# CLI and MCP adapters

The adapters format the same service operations for JSON command-line calls and MCP
stdio. Parameter schemas and help come from the protocol declaration; edits and
catalog behavior stay in the service/core. An adapter never edits the database.

After building, run `bun run screenrec --help` from the repository. For use outside
the checkout, `bun run install:personal` builds, installs the app into
`~/Applications` and writes a `screenrec` launcher into `~/.local/bin`. Pass
`-- --app PATH --bin DIR` to choose other absolute locations. The launcher runs the
CLI bundled inside the installed app under the Node 24 interpreter the build
recorded. That interpreter is a host prerequisite, not a bundled runtime. The
installer refuses to replace a running copy, and it prints the MCP command
(`screenrec mcp`) for client configuration. A rebuilt ad-hoc signature can require
granting screen and microphone access again. The help lists
implemented operations and their JSON schemas without connecting to the app.
`--params -` reads bounded JSON from stdin. Edit timestamps are integer microseconds
in the named revision's playback coordinates, with half-open ranges.

Use a stable mutation `params.requestId` and the same arguments when retrying an
uncertain write. `--id` identifies the transport request; it is separate from that
durable mutation identity. Operation failures retain the structured error and exit
nonzero; command-line usage errors go to stderr. MCP keeps stdout for protocol
messages and marks operation failures with `isError`.

Without `--socket`, the [client](../../packages/client/src/discovery.ts) finds the
service under `SCREENREC_HOME` (default `~/.screen-recorder`) and, when needed,
asks macOS to launch `~/Applications/ScreenRecorder.app`. Set `SCREENREC_APP` to an
absolute bundle path to select another installation. Discovery has one ten-second
budget and one launch attempt; it carries the resolved home into the app. An
already-running app keeps its original home, so a different requested home can
time out: quit/relaunch it with that home or connect to the intended service.

`--socket PATH` connects directly and never launches an app. Help, MCP tools/list,
and invalid requests do not discover or launch anything. Startup probes only read
health; each actual operation is sent once, with no automatic mutation replay.
MCP request cancellation also cancels discovery. Ordinary app launch starts its
service; recording and permissions belong to explicit capture operations.

Media operations return actual MCP image/audio content; a returned file path is not
an image-delivery implementation. Installed-app proof
remains in [personal release verification](../../specs/recording-for-ai/slices/15-personal-release.md).
