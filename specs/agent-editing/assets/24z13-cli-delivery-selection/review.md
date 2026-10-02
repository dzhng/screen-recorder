# Closeout review

Shape: selection remains in the caller; dispatch requires an explicit socket.
Both callers retain their cancellation fields, and the artifact/discovery/lease
owners are unchanged. Naming was swept across both callers and their tests; the
dispatch comment now describes retained selection. No new runtime owner or guard
was introduced. The shared fixture stays in the existing CLI consumer suite;
its size buys real single/batch/disappearance coverage rather than private hooks.

Diff: validation still precedes discovery. CLI discovery failures retain the
same outer error mapper/request ID. Per-item errors, cleanup, file publication,
MCP admission and selected-path behavior remain on their existing routes.
The three regressions were falsified against the original emitted main; corrected
assertions preserve the existing transport's actual first-error policy.

Docs: the leaf separates this CLI correction from unchanged historical24z12
proof and from installed, timing and media acceptance. Root owns hub wiring.
Choices disclose fixture layout, batch exit policy and compact runtime references.
Local review is clean; independent peer review and root integration are separate.

Independent peer review is clean against base2591aa28. It checked final source
pins main.ts `2d457d37…1aca`, main.test.ts `0dfaba2c…eacd` and emitted main.js
`58220bd2…c995`, the complete byte/metadata oracles and retained red/green traces.
The peer ran no tests or services. Renewal is preserved through the unchanged
reader and neighboring coverage; the new short-lease CLI fixtures add no renewed
CLI runtime claim. Root's independent source review also found no issue.
