# Durable project owner — core checkpoint

The [ProjectStore tests](../../../../packages/core/src/projects.test.ts) exercise
real SQLite catalogs in scratch homes, shared AssetStore admission and the real
composition reducer. Four project cases cover restart/replay, changed-argument and
stale-head rejection, undo/restore identities, no-op receipts, pinned history,
late-operation rollback, historical asset retention and competing catalog writers.

The focused project/asset/job/library run passes 90 tests; core type checking and
build pass. Independent Codex review found no actionable correctness, atomicity,
resource or ownership issue in this scope. The initial [red run](red.txt) precedes
the project owner. Metadata conversion preserves shared asset offsets and occupied
gaps; it is owned by the asset module for later compiler/service reuse.

Every edit atomically stores its immutable revision, complete replay receipt,
current pointer, undo target and retained asset references through the existing
Catalog transaction owner. Replay is checked before stale-head and asset lookup.
A no-op records a receipt without growing history; undo/restore append identities.

This accepts only the core persistence seam. The subsequent [public integration checkpoint](../04-public-projects/README.md)
verifies CLI/MCP state journeys. Project deletion lifecycle remains open in slice 04. No native
rendering, generated-speech quality or live media journey is claimed.
