# 04 — Durable projects and shared commands

Status: not started. Dependencies: [02](./02-assets.md), [03](./03-edits.md).

## Contract

The same CLI/MCP calls create and atomically edit durable managed projects with revision pinning, replay, undo and restore.

## Seam and ownership

Core ProjectStore composes the pure reducer with the one catalog transaction owner. Add project.create/list/get/delete, edit.apply/undo/restore and revision.get/history schemas to packages/protocol. Use existing CLI JSON stdin and MCP dispatch; do not invent space-separated subcommands.

## Work and review surface

Use the fresh library layout in architecture.md. Commit document, replay receipt, dependency references and undo state together. Only ready assets enter a batch. Prepare jobs and files outside transactions; expose one shared job.get/retry/cancel contract for preparation jobs. Preserve replay-before-stale checks and new revision identities for undo/restore. Return created IDs and edit expansion.

Create this planned probe in this slice:

```sh
node packages/test-harness/editing/projects.mjs --transport both
```

## Acceptance

Exercise competing writers, replay after restart/lost response, changed args with same ID, failure after several valid operations, stale state, no-op receipt, history pagination and dependency retention across undo. CLI/MCP normalized outcomes match. Preparing an asset then failing a batch leaves no project mutation.

Keep the relevant [preservation gates](../verification.md#preservation-matrix) green. The [contracts](../contracts.md) and [single-owner rules](../architecture.md) are binding. Record evidence and remaining limitations in this Status line and the [README handoff](../README.md) before ending the pass.

## Failure boundary and discretion

A DB migration or second catalog introduced to avoid refactoring is a design failure; keep the existing installed library untouched and use the agreed fresh library. Do not reset it as part of a test.

Delegated: Table/index names and canonical serialization implementation. The transaction, fresh-library and retry contracts are not delegated.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.
