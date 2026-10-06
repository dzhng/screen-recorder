# 03 — Unify asynchronous publication replies

Status: completed (public-envelope checkpoint). Depends on: None. Public reply controls use authored inputs and external execution boundaries; real-media acceptance remains in [34](34-autonomous-trailer-acceptance.md).

## Contract

Consumers can distinguish acknowledgement, pending/failed work and typed published output without guessing result versus published.

## Seam and ownership

Protocol async reply schema plus service operation adapters and generic job storage. Public domain output uses published; internal serialized worker results stay internal. Existing job owner remains the only supervisor.

Current owners and starting checks:

- [packages/protocol/src/operations.ts](../../../packages/protocol/src/operations.ts)
- [packages/core/src/jobs.ts](../../../packages/core/src/jobs.ts)
- [packages/core/src/job-publication.test.ts](../../../packages/core/src/job-publication.test.ts)
- [apps/service/src/project-service.ts](../../../apps/service/src/project-service.ts)
- [apps/cli/src/result-delivery.test.ts](../../../apps/cli/src/result-delivery.test.ts)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

Select one public shape: state, jobId/attempt or generation identity, pinned selection, progress/error, and published output when ready. Change job.get and prepared operations together under the hard cutover; remove obsolete consumer field readers. Preserve export committed semantics and pending cleanup rather than folding them into false generic success.

Frozen publication shape: `published: { generation, attemptId?, output } | null`.
`output` is the typed payload for the named operation/artifact; publication
generation and an available original attempt identity describe the retained
output, independently of the current pending job's generation/attempt. Use only
identities supplied by the actual owner. Keep internal serialized worker results
private. Existing domain readiness, pinned selections, diagnostics and export
commitment/cleanup meanings retain their contracts. Synchronous read pages and
export receipts retain their own output contracts; they are not fabricated jobs.

## Runnable checkpoint

Queued/running/ready/failed replies through CLI and MCP, with typed published artifact identity.

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

The [retained checkpoint](../assets/03-published-work/README.md) records accepted replies, red/green scope, consumer verification, confirmed review fixes and the clean follow-up review. Native package export remains a final-run check; no new native media work or inference was required for this public JSON cutover.

Controls cover failed jobs in ok transport envelopes, canceled jobs, lost acknowledgement/replay, large result leases and malformed worker results. Reproduce delayed large import; current prepareImport is already stat-only and durable, so change admission only if latency actually violates its bounded acknowledgement.

No visual verdict is required for a JSON-only checkpoint. If this slice produces a visual artifact, declare its variable/mask, compare it using compare-screenshots and obtain an unprimed screenshot-critique as the last visual check before acceptance. Artifact viewing never requires human QA.

A spike passes with a frozen accepted recipe/reference, or records a failed verdict and reslices dependent work. An unavailable stub or undocumented fallback is not implementation completion.

## Delegated choices

Internal schema composition and adapter structure. No duplicate result/published aliases or version negotiation.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

Durable request identity, cancellation/drain, stale-attempt exclusion and complete large replies retain their behavior.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.
