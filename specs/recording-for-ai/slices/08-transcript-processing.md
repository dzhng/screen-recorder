# 08 — Durable local transcription and projections

Status: not started. Dependencies: 04, 06.

Read [architecture](../architecture.md), [contracts](../contracts.md), and
[verification](../verification.md) before implementation. Commands below are planned
harness entrypoints to create in this slice, not existing executable claims.

## Contract and API seam

Source narration becomes a faithful word-timed artifact; edits project it without retranscribing or rewriting.

Integrate only the selected engine behind the native speech worker contract. Add explicit model prepare/status and pinned acquisition; absent assets fail meaningfully and never trigger cloud use. Retain raw output and source words, project revision transcript/events through core, and publish readiness for the correct artifact generation. Allow frame inspection even if speech fails.

## Runnable checkpoint

Run bun run lab:transcript on a real recorded take containing a pause, filler, repetition and target phrase. Read paged words and literal search results, edit mid-word, observe clipped fragments, kill transcription, restart, retry and compare source hashes.

## Acceptance

Word IDs/source ranges remain stable across projections; current/historical requests identify revision and generation. No cleanup drops ums. Missing narration is an explicit empty/unavailable case; system audio remains separately accessible. Retry does not duplicate a running job.

## Decisions delegated and scope firewall

Model adapters and internal chunking are delegated only within the passed engine configuration. Chunk boundaries must not duplicate/drop words; changes affecting fidelity rerun slice 04's relevant held-out checks.

## Visual review

Transcript text/JSON is primary. Any transcript timing graphic or screenshot is reviewed for alignment only, with compare-screenshots when reference exists and screenshot-critique last.

Follow the exact skill links and non-blocking human review procedure in
[verification](../verification.md#visual-gates). If this slice produces no visual
artifact, retain its machine-readable evidence instead; do not manufacture UI just
for a screenshot gate.

## Stay green and feedback

Keep dependency slices' focused checks green. Update this slice's status/evidence
and the README Next Agent Prompt at each green checkpoint. Tests must pin consumer
behavior, not implementation constants. Run the narrowest relevant checks during
iteration; full-suite closeout belongs to slice 15.

If integration differs from the evaluated runtime or loses word accuracy, the model gate reopens; do not accept a passing probe for a different production decoder.

