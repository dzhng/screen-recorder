# 04 — Wait for and deliver evidence predictably

Status: planned. Depends on: [03](03-published-work-contract.md).

## Contract

One CLI request can wait within a deadline and write final media/measurement JSON through the existing delivery owner.

## Seam and ownership

CLI main/artifact delivery and client deadlines; service delivery leases. Add audio.measure JSON artifact delivery, not access to measurement.file inside the cache.

Current owners and starting checks:

- [apps/cli/src/main.ts](../../../apps/cli/src/main.ts)
- [apps/cli/src/artifact-delivery.ts](../../../apps/cli/src/artifact-delivery.ts)
- [apps/cli/src/artifact-delivery.test.ts](../../../apps/cli/src/artifact-delivery.test.ts)
- [apps/service/src/delivery.ts](../../../apps/service/src/delivery.ts)
- [apps/service/src/loudness.test.ts](../../../apps/service/src/loudness.test.ts)
- [packages/client/src/transport.test.ts](../../../packages/client/src/transport.test.ts)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

Add --wait with an explicit timeout. Freeze source/revision/generation from the first acknowledgement; poll advertised reads/job identity, never resubmit mutations or retry failures automatically. Progress goes to stderr, stdout emits one final envelope. Timeout returns pending state and durable identity, never claims rollback. Deliver files only after complete leases; batches retain partial failures.

## Runnable checkpoint

Public CLI frame, waveform and audio.measure --output journeys, including pending timeout and cancellation.

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

Delayed readiness, nonadvancing/expired chunks, changed selection, disappeared service, partial frame batch and failed job must terminate with truthful status and no partial final file. Verify measurement JSON bytes and cleanup; no filesystem-existence polling.

No visual verdict is required for a JSON-only checkpoint. If this slice produces a visual artifact, declare its variable/mask, compare it using compare-screenshots and obtain an unprimed screenshot-critique as the last visual check before acceptance. Artifact viewing never requires human QA.

A spike passes with a frozen accepted recipe/reference, or records a failed verdict and reslices dependent work. An unavailable stub or undocumented fallback is not implementation completion.

## Delegated choices

Deadline flag spelling and progress formatting; explicit bounded defaults must be recorded in help and tests.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

Leases drain, help remains service-free, writes submit once, output ownership and MCP framing remain correct.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.
