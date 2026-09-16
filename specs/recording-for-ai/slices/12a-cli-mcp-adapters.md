# 12a — CLI/MCP adapters for implemented operations

Status: implemented and reviewed for the current library/edit operations.
Dependencies: 06e. This materializes the adapter seam early; parent 12 remains open
until capture, evidence, jobs, exports and relocated packages share it.

Both adapters derive help/tools from the protocol's implemented operation schema
and dispatch through the existing local client. There is no adapter-specific edit
logic. MCP uses the official SDK, retains structured results/errors, and keeps
startup diagnostics off its stdout protocol channel. JSON CLI input can come from
arguments or bounded stdin, with explicit request identity and mutation replay.

Real subprocess tests exercise CLI and MCP against the actual Node service and
SQLite catalog. They check retained spans after a cut, replay through the other
adapter, stale-write parity, undo and history, malformed parameters, oversized
input, and help before any service exists. Independent review found correlation
and MCP error-output defects; retained red/green regressions cover both fixes.
The owning code and tests are in [the CLI package](../../../apps/cli/README.md).

Default discovery/auto-launch now has a separate [verified client subpass](15a-client-discovery.md);
real installed-app proof remains open. Remaining gates include full operation
coverage as the service gains capabilities, real image/audio blocks and the final
actual-agent inspection/edit journey. `--socket` provides current connection
selection; it is not evidence that automatic app discovery works.
