# Slice 04 — capability/catalog parity and closeout

## Contract unlocked

The app, CLI and MCP describe and invoke the same public operation catalog.
`packages/protocol/src/operations.ts` remains the single machine-readable
owner; adapters project it rather than inventing parallel capability registries.

Cap's capability enum and `required_capability` mapping are centralized in
[`crates/automation/src/lib.rs:95-132`](https://github.com/CapSoftware/Cap/blob/2c51caae0a952340be7f57a95813e7c8d0d1df1d/crates/automation/src/lib.rs#L95-L132),
while desktop inspection and CLI commands expose that same model
([`apps/desktop/src-tauri/src/automation.rs:899-974`](https://github.com/CapSoftware/Cap/blob/2c51caae0a952340be7f57a95813e7c8d0d1df1d/apps/desktop/src-tauri/src/automation.rs#L899-L974), [`apps/cli/src/main.rs:190-245`](https://github.com/CapSoftware/Cap/blob/2c51caae0a952340be7f57a95813e7c8d0d1df1d/apps/cli/src/main.rs#L190-L245)).

## Yap seam and ownership

Keep the operation catalog and descriptions in
[`packages/protocol/src/operations.ts:1412-1489`](../../../packages/protocol/src/operations.ts:1412).
Pin CLI/MCP projections using existing adapter tests and add only the smallest
app-facing fixture or help parity assertion needed to detect drift. Do not
create a second capability registry.

## Tests and closeout

- Preserve existing CLI/MCP catalog parity tests in `apps/cli/src/main.test.ts`.
- Add a fixture-driven check that app-visible capture operations are members of
  the protocol catalog and that finalizing/error/complete responses decode from
  the shared protocol shapes.
- Update the owning READMEs with the internal lifecycle/recovery invariants;
  do not copy the operation matrix into documentation.
- Run the repository's full check suite once after all four slices, as required
  by the root `AGENTS.md` instructions.
- Run `refactor-clean` over removed duplicate validators and any stale owner
  names before declaring the plan implemented.

## Firewalls

No remote delivery, no upload capability, no app-only capability registry, and
no public contract expansion. Any exception must reopen the map and become a
new slice rather than an implementer choice.

## Implementation evidence

- Added [`packages/protocol/fixtures/app-capture-contract.json`](../../../packages/protocol/fixtures/app-capture-contract.json), a fixture of the capture and recording operations issued by the macOS app and native lifecycle receipts for `finalizing`, retryable finalization error, and `complete`.
- Added a protocol test in [`packages/protocol/src/index.test.ts`](../../../packages/protocol/src/index.test.ts) that checks every fixture operation against `operationNames` and `operationSchema`, then decodes each lifecycle receipt with `captureReportSchema` inside the shared `responseSchema` envelope.
- The test was red when the fixture was absent and when `capture.sources` was changed to an unregistered name, then green after restoring the canonical fixture. Focused proof: `bunx vitest run packages/protocol/src/index.test.ts` (29 tests passed).
