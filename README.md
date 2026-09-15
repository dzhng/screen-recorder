# Screen Recorder

A local macOS recorder that gives external AI agents inspectable narration, images,
pointing history and non-destructive edits. Source media remains intact; the app,
CLI and MCP share the same recording and editing contracts.

## Development

Bun installs and orchestrates; Node 24 runs TypeScript and Swift builds the native
macOS boundary. Run `bun install` before building. The [root manifest](package.json)
owns executable build and check commands. Use focused package checks during
iteration; full release verification belongs at closeout.

The [active spec](specs/recording-for-ai/README.md) owns current implementation
status and verification evidence. Its [architecture](specs/recording-for-ai/architecture.md)
explains ownership, while [contracts](specs/recording-for-ai/contracts.md) defines
how timestamps, revisions and evidence stay aligned. Planned capabilities are not
claimed as implemented until their named gates pass.
