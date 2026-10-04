# Architecture and ownership

Historical recording-design record. The [recording guide](README.md) owns its
scope and points to current implementation; this document does not reopen old work.

These are planning decisions made from the discovery map and independent drafts.
They are intended defaults for the personal release, not claims of implemented behavior.

## Target and conventions

Target Apple Silicon and macOS 26 for the personal release, built with the Command
Line Tools developer directory; the [root manifest](../../../package.json) pins the Node
engine and Bun version. Do not require Intel/Linux
validation or a paid distribution setup. Prove a SwiftPM-built local `.app` bundle
with stable bundle identity first; investigate missing tooling only if that fails.

Bun installs and orchestrates; Node 24 runs TypeScript/ESM and Vitest. Use Turborepo,
oxfmt, oxlint, and explicit `workspace:*` dependencies, matching the common pattern
of the user's Factory and Photoctl monorepos. Pin exact dependencies and lockfiles
when bootstrapping; do not copy stale version numbers merely for visual similarity.

## Monorepo shape

| Location | Owner and consumers |
| --- | --- |
| `apps/macos` | Native Swift menu-bar shell: selection, permissions, recording controls, native capture clock/state. Owns a package manifest for root build orchestration and its SwiftPM app target. |
| `apps/service` | App-managed Node process; composes core, native media calls, and the local socket server. No domain behavior lives in this composition root. |
| `apps/cli` | `screenrec` CLI plus `screenrec mcp` stdio entrypoint. Formats the same operations for human, JSON, and MCP clients. |
| `apps/workbench` | Development-only localhost demonstration fixtures; [its page](../../../apps/workbench/public/index.html) owns the fixture set. Not the future editing UI. |
| `packages/protocol` | Public operation definitions, schemas, result/error envelopes, time/ID types, native wire messages, generated JSON Schema and native conformance fixtures. |
| `packages/core` | Cohesive modules for library/revisions, pure timeline mapping, evidence selection, jobs, and export planning. Split modules by concept; no package per noun. |
| `packages/client` | User-local socket client and app discovery. Used by CLI/MCP, never a second business-logic owner. |
| `packages/test-harness` | Opt-in lab runners, the speech evaluator and the root forwarding point for labs whose suites live beside the app or helper they exercise. |
| [helpers/mac](../../../helpers/mac/README.md) | Swift package for ScreenCaptureKit, AVFoundation frame/render operations, capture journal and cursor geometry, plus the selected local speech runtime. Consumed by the app and a bounded media-worker executable. |
| `scripts` | App bundle build, personal install, and native probe and evaluation command lines run from the repository root. No runtime editing behavior. |

Do not create an empty package merely because this table names it; materialize each
with its first consumer. No Rust, Electron/Tauri, hosted service, generic plugin
system, public updater, or separate always-running daemon is required.

## Runtime boundary

The native app is the lifetime owner. It launches one Node service child over a
private bidirectional JSON-lines channel. The Node child listens on a Unix socket
under `~/.screen-recorder/run/`; CLI/MCP are short-lived clients. An explicit CLI
connection can launch the app when absent; it must never start recording merely
because a read tool was called. One instance/socket owner; bounded startup timeout
(10 seconds) reports actionable failure instead of repeated relaunch attempts.

Native controls request operations through the service. The service allocates the
recording ID and directory before instructing native capture to start. Native owns
`idle/selecting/recording/paused/finalizing` device transitions; core persists their
reported state and owns every library/revision/job mutation. It must not invent a
parallel device state machine. Permission denial returns to idle with an error.

Native writes source media plus a capture journal only inside its allocated source
directory. It never edits the library database. The service is the only metadata
writer, using SQLite through Node's bundled SQLite API; native completions are
idempotently ingested by sequence number. Do not hold a database transaction while
encoding or transcribing. The durable journal allows ingestion after service death.

If the service disappears during capture, native safely finalizes the current take
and leaves a recoverable journal; no silent continued unindexed capture. Relaunch
reconciles sources. Normal app quit during capture finalizes before quitting;
forced termination follows the explicit interrupted-recording path. Background
workers are killed or cleanly canceled with the app and become retryable jobs.

Expensive frame/export/transcription work runs in bounded Swift worker processes,
not the UI thread. Native worker requests carry an explicit source path and resolved
media plan. Screen/microphone capture remains in the stable app identity for macOS
permissions. Never send video/audio blobs through the control channel.

## One owner per concept

| Concept | Sole authority |
| --- | --- |
| Native capture time → source playback time | Swift capture session: host/media clock alignment and removal of pauses. |
| Source time → edited playback time | Pure `packages/core` timeline module. |
| Source/frame coordinate transforms | Swift geometry samples tied to captured media; TS receives output-pixel coordinates. |
| Edit validation, undo, revision pointer | Core transaction boundary. |
| Transcript/index/cursor projection through edits | Core using the shared timeline mapping. |
| Frame decode and pixel drawing | Native worker executing explicit source time/coordinates and trail points. |
| Trail cutoff and screenshot selection | Core evidence module; native renderer does not choose hidden points or cuts. |
| Processing state and retry | Core jobs module. |
| API capabilities | Protocol declarations; service binds core handlers by ID. CLI and MCP coverage mechanically checked without a protocol-to-core import. |
| Video export timeline | Core render plan; native AVFoundation executes spans without interpreting user intent. |
| AI package layout/reopening | Core package reader/writer using the same inspection interface as the local library. |

Native Codable wire types may mirror schemas, but must consume shared conformance
fixtures. No Swift copy of edit algebra, and no TypeScript copy of Retina geometry.
Avoid a general schema-generation framework for this bounded boundary.

## Files and persistence

Personal root: `~/.screen-recorder/`, overrideable as `SCREENREC_HOME` for tests.
Store `library.sqlite`, `recordings/<id>/source/`, immutable revision manifests,
versioned transcript/index artifacts, and bounded derivative caches. Model assets
live separately under `models/` and survive deletion of a recording.

Original media is immutable after capture finalization/recovery. Captured video has
no burned-in cursor so a clean frame is possible; human renders add the current
pointer. Raw cursor samples preserve observed movement even if display rendering
later changes. Pause and geometry journals are retained beside sources.

Directory/socket permissions restrict the local service to the user. This is not a
remote authenticated API. Export packages contain relative paths and do not depend
on personal root paths. Fresh schema version 1; no migrations or compatibility
wrappers for unshipped formats. Reject unsupported packages explicitly.

## Refactor audit verdict

The accepted architecture has one service/domain owner and one native executor
boundary. There is no UI-only editor, second timeline, separate export projection,
or substitute portable-package inspection engine. A spike can be promoted into its
owner or kept as a test harness; competing spike implementations must be removed
when their selection gate closes. Do not retain a fallback abstraction unless its
chosen production consumer requires it.
