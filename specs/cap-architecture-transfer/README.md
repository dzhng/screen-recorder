# Cap architecture lessons for local Yap capture

Status: implementing; slices 01–03 complete. Last updated 2026-10-10.

This plan transfers the useful local architecture from Cap at commit
`2c51caae0a952340be7f57a95813e7c8d0d1df1d` into Yap. Remote delivery,
uploads and Cap's cloud project model are out of scope.

## Contract and end state

Yap keeps its public capture contract:

- `Recording.state` remains `preparing | recording | paused | finalizing | complete | interrupted | canceled` ([`packages/core/src/capture-store.ts:8-30`](../../packages/core/src/capture-store.ts:8)).
- `capture.stop` begins finalization; its acknowledgment is not completion ([`packages/protocol/src/operations.ts:1440-1444`](../../packages/protocol/src/operations.ts:1440)).
- `finalizationError` remains the durable retry signal, and `CAPTURE_NOT_QUIET` remains the deletion fence ([`apps/service/src/capture.ts:216-264`](../../apps/service/src/capture.ts:216)).
- No public `quiescence`/`unconfirmed` field and no `capture.recovery` operation are added. Existing status, `recording.get`, stop retry, and cleanup answers remain the single public lifecycle surface.

The internal end state is Cap-like: one owner knows whether native capture and recovery workers have actually joined; recovery validates durable evidence before publication; ambiguous media is retained; preview work reuses or measures existing resources before adding machinery; and the protocol operation catalog remains the machine-readable capability surface shared by app, CLI and MCP.

This is a hard internal cutover with no compatibility shim, data migration or
deploy-order choreography. The persisted/public recording contract remains
backward-compatible because it is intentionally unchanged.

## Four-quadrant map

### Known knowns

- Cap's `InstantLifecycle` separates cancellation from joined work and retains terminal errors ([`crates/recording/src/instant_recording.rs:45-115`](https://github.com/CapSoftware/Cap/blob/2c51caae0a952340be7f57a95813e7c8d0d1df1d/crates/recording/src/instant_recording.rs#L45-L115)); `Actor::stop` cancels pipelines, joins them and preserves the first terminal stop error ([`.../instant_recording.rs:394-485`](https://github.com/CapSoftware/Cap/blob/2c51caae0a952340be7f57a95813e7c8d0d1df1d/crates/recording/src/instant_recording.rs#L394-L485)).
- Cap's recovery is manifest-driven and validates existence, sizes, complete fragments and decodability before publication ([`crates/recording/src/fragmentation/manifest.rs:4-57`](https://github.com/CapSoftware/Cap/blob/2c51caae0a952340be7f57a95813e7c8d0d1df1d/crates/recording/src/fragmentation/manifest.rs#L4-L57); [`crates/recording/src/recovery.rs:451-617`](https://github.com/CapSoftware/Cap/blob/2c51caae0a952340be7f57a95813e7c8d0d1df1d/crates/recording/src/recovery.rs#L451-L617)).
- Cap retains originals while staging, rechecks source snapshots, fsyncs and publishes atomically with rollback ([`crates/recording/src/recovery.rs:1031-1188`](https://github.com/CapSoftware/Cap/blob/2c51caae0a952340be7f57a95813e7c8d0d1df1d/crates/recording/src/recovery.rs#L1031-L1188)).
- Cap reuses an open editor's decoders/GPU resources for preview ([`crates/export/src/preview.rs:137-209`](https://github.com/CapSoftware/Cap/blob/2c51caae0a952340be7f57a95813e7c8d0d1df1d/crates/export/src/preview.rs#L137-L209)).
- Cap has one capability model evaluated by automation hosts and exposed by desktop and CLI surfaces ([`crates/automation/src/lib.rs:95-209`](https://github.com/CapSoftware/Cap/blob/2c51caae0a952340be7f57a95813e7c8d0d1df1d/crates/automation/src/lib.rs#L95-L209); [`apps/desktop/src-tauri/src/automation.rs:899-974`](https://github.com/CapSoftware/Cap/blob/2c51caae0a952340be7f57a95813e7c8d0d1df1d/apps/desktop/src-tauri/src/automation.rs#L899-L974); [`apps/cli/src/main.rs:190-245`](https://github.com/CapSoftware/Cap/blob/2c51caae0a952340be7f57a95813e7c8d0d1df1d/apps/cli/src/main.rs#L190-L245)).
- Yap already has the required durable owners: native journal/writer, serialized capture service, `CaptureStore`, immutable composition, `ProjectPreviewInspection`, and the shared protocol operation catalog.

### Known unknowns, closed decisions

| Question | Decision | Closed by and why |
|---|---|---|
| Should Yap expose Cap's `Unconfirmed` state? | No. Keep ambiguity in retained media plus retryable `finalizationError`; keep quiescence internal and deletion-fenced. | Answered by the agent on the user's behalf, following the user's delegation: a second public lifecycle axis would add noise to an already explicit contract. |
| Should Yap add `capture.recovery`? | No. Improve recovery behind `capture.status`, `recording.get`, `capture.stop` retry and existing publication evidence. | Answered by the agent on the user's behalf: one lifecycle question should have one public path. |
| Should preview get a new API/owner? | No by default. Measure the existing warm/cached path first; optimize only the demonstrated bottleneck. | Answered by the agent on the user's behalf: Cap's lesson is resource reuse, not API multiplication. |
| Should Yap copy Cap's serialized timeline/project model? | No. Keep immutable composition and revision owners. | Architectural judgment from the source review: Cap's mutable `TimelineSegment`/`TimelineConfiguration` is broader than Yap's local contract. |
| Is remote delivery included? | No. | User decision. |

### Unknown knowns extracted from Yap

- The caller consumes lifecycle as evidence, not permission: it must be able to distinguish “stop accepted” from “media is importable.” This is encoded in the operation descriptions and finalization tests.
- Native owns facts and native journal sequence; the service owns allocation, reconciliation and service-authored events; core owns persistence and legal state transitions. The protocol schemas explicitly reserve native sequence space ([`packages/protocol/src/capture.ts:75-107`](../../packages/protocol/src/capture.ts:75)).
- Done means restart-safe retries and safe deletion, not a prettier state enum. Existing close/deletion tests already exercise this ([`apps/service/src/capture-lifetime.test.ts:1-540`](../../apps/service/src/capture-lifetime.test.ts:1)).

### Unknown unknowns / landmine cards

1. **Stop acknowledgment can be mistaken for completion.** Evidence: [`packages/protocol/src/operations.ts:1440-1444`](../../packages/protocol/src/operations.ts:1440). Impact: never make stop synchronous or import media before terminal state.
2. **Deletion can race native writes.** Evidence: [`apps/service/src/capture.ts:234-264`](../../apps/service/src/capture.ts:234). Impact: every cleanup path must join workers and recheck native quietness; ambiguous bytes stay retained.
3. **Recovery has multiple validators today.** Evidence: `readRecovery` and inline checks in [`apps/service/src/capture.ts:468-729,879-925`](../../apps/service/src/capture.ts:468). Impact: consolidate validation behind one strict owner before adding checks.
4. **Native and service sequence producers share a monotonic contract.** Evidence: [`packages/protocol/src/capture.ts:75-81`](../../packages/protocol/src/capture.ts:75). Impact: lifecycle refactors must preserve the sequence partition.
5. **Journal tails can be torn or oversized.** Evidence: [`helpers/mac/Sources/YapCapture/CaptureJournal.swift:206-278`](../../helpers/mac/Sources/YapCapture/CaptureJournal.swift:206). Impact: recovery must treat the journal reader's boundary as evidence, never guess past it.
6. **Close already drains recovery.** Evidence: [`apps/service/src/capture-lifetime.test.ts:21-71`](../../apps/service/src/capture-lifetime.test.ts:21). Impact: do not introduce a second worker owner or unjoined background task.

## Tweakable implementation plan

The most judgment-heavy choices are first. Mechanical work is at the bottom.

1. **Lifecycle/quiescence discipline** — [`slices/01-lifecycle.md`](slices/01-lifecycle.md). Adopt Cap's internal cancel → join → terminal-error ordering while preserving Yap's public states and errors.
2. **Validated recovery** — [`slices/02-recovery.md`](slices/02-recovery.md). Give recovery one strict evidence owner, retain ambiguous media, and preserve retry semantics.
3. **Preview resource measurement** — [`slices/03-preview.md`](slices/03-preview.md). Benchmark the existing warm/cached owner; only change scheduling or reuse if evidence warrants it.
4. **Catalog parity and closeout** — [`slices/04-parity.md`](slices/04-parity.md). Keep `packages/protocol/src/operations.ts` as the machine-readable capability source and pin app/CLI/MCP projections to it.

All slices require tests first, narrow verification, and a final full suite only after the complete spec is implemented. No slice changes the public operation list or recording state union unless a later explicit decision reopens this map.

## Next Agent Prompt

Implement `specs/cap-architecture-transfer` slice by slice. Continue with
`slices/04-parity.md`; read the referenced Yap and Cap code before editing.
Slices 02 and 03 are complete: recovery receipt validation has one owner and
the warm preview cache is proven, so no preview production change is pending.
Preserve the public capture contract and write the failing behavior test before
changing behavior. Do not add `quiescence`, `unconfirmed`, or
`capture.recovery`; do not touch remote delivery. After each slice, update this
README's status, evidence and TODO checklist, and run the narrowest check that
proves the slice. Run the full suite only after slice 04. If a slice reveals a
new design choice, stop and reslice this plan before coding further.

Global TODO:

- [x] Slice 01: internal lifecycle and quiescence ownership (28 focused tests).
- [x] Slice 02: strict recovery evidence and publication validation (54 capture tests).
- [x] Slice 03: preview measurement and evidence-based optimization (17 preview tests).
- [ ] Slice 04: app/CLI/MCP catalog parity, docs and full verification.
