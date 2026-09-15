# CLI/MCP adapter checkpoint

Root built and type-checked the new CLI workspace and exercised its actual process
entrypoint plus the official SDK's MCP stdio client against the real service/catalog.
Retained-span values, cross-interface edit replay, stale-write error parity, undo and
history all pass. Registry-derived help works without a service. Oversized argument
objects are refused through both adapters; CLI stdin avoids shell argument limits.

Independent Codex review reproduced two local error-path defects: malformed JSON
lost a supplied request ID, and an invalid MCP invocation with options before the
command printed diagnostics to stdout. Both retained regressions failed before the
fix and pass afterward. Argument parsing failures now use stderr before a protocol
mode can be known, and local validation preserves a successfully parsed ID. Invalid
UTF-8 on stdin is refused rather than rewritten into another recording identifier.

The reviewer could not run socket tests in its sandbox. Root's real-process tests
supply runtime evidence; the review's type checking alone is not that evidence.
Focused lint/format and `bun run screenrec --help` also pass.

This proves current library/edit adapter behavior, not the full actual-agent media
journey. Connection selection is currently explicit `--socket`; automatic personal
app discovery, media content blocks and the rest of parent12's operations remain.
