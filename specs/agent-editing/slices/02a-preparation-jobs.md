# 02a — Shared durable preparation targets

Status: in progress. Dependencies: [00](./00-corpus.md).

## Contract

Import preparation, asset processing and pinned project work use the same durable
queue, cancellation, retry and recovery semantics. A pending import is a real job
even before an asset is ready; it is never represented as a fake recording.

## Seam and ownership

Generalize the existing core JobQueue target identity and admission lifecycle.
The shared Catalog owns the database connection and transactions; target owners
resolve immutable input/revision pins and retention. Preserve the existing queue's
capacity, attempt-generation, capture priority and transient package contexts.
The service exposes job.get/retry/cancel through the shared protocol registry.

## Work and review surface

Separate target-specific recording checks from scheduling once, and migrate the
existing callers to the explicit target contract. Do not create per-feature
queues or retain compatibility aliases. A retry preserves its original input
identity; changed external input requires a new import job or an explicit failure.
Cancellation drains resources before releasing retained dependencies. Source copy
and probe run outside transactions, and only ready assets can enter edits.

Drive the public queue controls in the slice 02 import harness, plus focused core
queue tests with recording, import, asset and pinned-project targets.

## Acceptance

Prove restart of interrupted attempts, replay, explicit retry, stale-attempt
publication rejection, cancellation/drain, fair bounded admission, capture
priority and dependency retention. Two feature types compete through the same
worker budget. Failed work cannot starve unrelated work. Preserve all existing
queue tests and add behavior tests for import before a ready asset exists.

Keep [verification](../verification.md) and [contracts](../contracts.md) binding.
Update this status and the [README handoff](../README.md) with actual evidence.
No visual output is accepted by this queue-only slice.

## Failure boundary and discretion

If generic scheduling still needs to query recording tables, separate the target
lifecycle boundary before adding asset callers. No second job implementation,
synchronous public-import substitute, or silent change to retry/cancel semantics.

Delegated: private SQL indexes and module split. Target identity, frozen input,
shared queue and lifecycle guarantees are fixed by the contracts. Record any
public identity choice not settled there in the choices ledger.
