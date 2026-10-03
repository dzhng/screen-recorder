# Editing UI

Status: deferred by the agent-editing discovery, 2026-09-27. The current request
prioritizes external agents operating through CLI/MCP; existing menu-bar recording
controls remain. The [agent editing spec](../done/agent-editing/README.md) owns the active
plan and its richer composition model.

## Next Agent Prompt

Do not implement an editing GUI as part of the active agent-editing plan. If the
user later activates UI work, inspect the then-shipped shared command and
composition contracts and design a thin client over them. It must not own another
editing engine, timing model, storage format or caption/attachment interpretation.

The earlier placeholder's trim/cut-only scope is superseded. Its original media
preservation, undo, revision pinning and honest readiness principles carry forward
through the shared engine. UI interaction and layout remain unplanned.
