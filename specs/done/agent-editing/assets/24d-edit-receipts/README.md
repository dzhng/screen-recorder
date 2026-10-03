# Single-document edit receipt evidence

The existing project revision owns the public committed document. The core editor
still produces its document internally; public `edit.apply` and `text.seed` return
only operation receipts beside the revision. One projection applies to fresh and
persisted responses. Historical stored receipt bytes remain untouched, while their
redundant `edit.document` field no longer appears in current responses. This is an
intentional developmental API change: replay preserves meaning and committed IDs,
not historical response byte shape across versions.

The previous 6,000-clip MCP failure is retained in [24c](../24c-edit-batch/README.md).
Continuation of that exact public project reached 10,000 clips through eight public
MCP calls, without reseeding or native rendering. The final result was 4,418,936 bytes;
the complete MCP envelope was 9,269,251 bytes, below the unchanged SDK 10 MiB bound.
Actual SDK delivery succeeded. CLI replay and service-restart MCP replay were deeply
equal. MCP text and structured content matched. The old failed request also replays
with the same committed revision and projected receipt while the current head stays
at 10,000 clips. No public or native framing limit changed.

Core apply/text-seed tests verify saved new receipts, fresh owner replay, projected
historical receipts and unchanged historical storage. The repository consumer sweep
found no use of the removed public field. CLI and MCP discovery now agree on the
single document location, with unchanged input schemas. Independent settled review
found no actionable regression. Verification logs and complete requests are retained
in the authenticated archive; no listening or two-hour preparation is claimed here.

Build order: composition, core, protocol, service, CLI. Focused checks are core
`projects.test.ts`/`text-seeds.test.ts`, service `project-service.test.ts`, CLI
`main.test.ts`, and core type checking. The public retained scripts preserve their
scratch locations as provenance. The existing denoise-scale harness remains the
owner of fresh complete scale setup and preparation; this receipt pass does not
introduce an alternate editor or renderer harness owner.

[Combined-root verification](root-verification.json) confirms build and the core/service/CLI response and replay checks. `root-verification.tar.gz` retains logs.
