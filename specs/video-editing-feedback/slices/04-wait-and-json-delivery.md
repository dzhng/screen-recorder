# 04 — Wait for and deliver evidence predictably

Status: complete. Depends on: [03](03-published-work-contract.md).

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

The protocol owns optional top-level `wait` metadata. `settled` means terminal domain work, not success; `timed_out` preserves pending acknowledgement (exit 2); `interrupted` preserves acknowledgement with a structured error (exit 1). Ready requested outcomes exit 0. `timeoutMs` is a positive integer no greater than the Node timer bound; discovery, admission, reads and media delivery share that one deadline. Cleanup uses the existing bounded lease-close owner after cancellation.

The optional `wait.job` reports the current job ID, generation and attempt independently of retained publication. Current job target/attempt/generation and initial source/revision selection stay pinned. A ready dependency triggers the requested pinned getter. `model.prepare` uses its advertised `model.status` getter with only model identity. Mutations submit once; retries are always explicit.

A completed retained-evidence page names its generation with the job's attempt
ID. The observer verifies that identity even though a ready page omits jobId;
it never adds an unsupported generation parameter to index.get. Every mapped
getter can itself start observation, and export create/status/retry/recover all
lead to export.status. Single and batch files share atomic publication and
preserve completed sibling items after a failure.

Export status keeps the original publication job at top level and exposes any
reconciliation job under recovery. When recovery work exists, observe and pin
that job through its advertised identity, then fetch export.status; an old
publication failure cannot terminate newly queued recovery or replace its domain
reply. The current-work choice stays separate from the final export receipt.
Terminal recovery failure/cancellation likewise returns the export.status
domain reply, retaining its historical receipt and destination. CLI success
requires the observed recovery to be ready at its pinned generation as well as
the requested export outcome; a historical committed file cannot hide failed
current recovery. Terminal job inspection is repeated after a pending getter
refresh so retry races remain subject to the existing attempt pins.

Package opens use the advertised package.status getter with the acknowledged
admissionId (the existing response's data.id). Package.status can also start
observation. The response's opaque context-job ID is not a public job.get target;
admissions and handles remain process-local, with no wait.job or restart durability invented. Timeout keeps
the admitted identity without claiming rollback, and the adapter never resubmits
package.open. A service restart's admission-not-found reply interrupts observation
while preserving the last admission acknowledgement and the owner's error.

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

## Implementation evidence

[Wait and delivery evidence](../assets/04-wait-and-delivery/README.md) retains the
public-consumer checks and controlled production-service JSON journey. Ready
measurement leases use the existing cache/delivery owners. JSON files validate
UTF-8 and complete JSON before atomic publication, within the acoustic producer's
file bound; buffered MCP evidence keeps its existing tighter bound.

Scoped proof passes 130 tests across eight files, with successful CLI build,
CLI/service/protocol type checks, lint and formatting. Shape, diff and docs review
are resolved; the independent final verdict is clean. This proves wire observation,
publication and JSON delivery, with controlled PCM/scanner responses. It does not
claim native inference, rendering quality, live app verification or the feature
completion full suite. The evidence folder retains those boundaries and review
completion hashes.
