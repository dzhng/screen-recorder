# 11 — Useful bounded screenshot index

Status: the [selection ledger](11a-selection-ledger.md) and
[shared materialization](11b-shared-frame-materialization.md) are verified;
[retained/public index](11c-retained-index.md) delivery passes the thirty-minute
generated workload. Real-capture selection usefulness and threshold gates remain
open. Dependencies: source evidence, 10f canonical scenes and existing frame rendering.

Read [architecture](../architecture.md), [contracts](../contracts.md), and
[verification](../verification.md) before implementation. Commands below are planned
harness entrypoints to create in this slice, not existing executable claims.

## Contract and API seam

Automatic selection preserves screen changes and cursor-only emphasis without flooding the AI with duplicates.

Implement the deterministic selection policy in contracts.md using the shared scene-boundary output from slice 10 plus raw cursor bursts; do not add another scene detector. Store reason, source/edited time, coverage interval and frame reference for each candidate. Reproject/rebuild revision-specific index at cuts. Distinguish selected evidence from disposable on-demand frame cache.

## Runnable checkpoint

Run bun run lab:index on static pointing, long still screen, continuous animation, scroll/navigation, several rapid clicks, and an edited join. Produce a contact sheet plus machine-readable reason/coverage ledger. Page the 30-minute fixture and report analysis work/memory.

## Acceptance

Static circle/wave yields evidence despite duplicate background; cursor motion does not count as full-screen scene change. Repeated still frames collapse while index coverage remains explicit. Brief important fixture state survives or is available via timestamp requests; selected-frame policy is transparent.

## Decisions delegated and scope firewall

Pixel-change thresholds and motion distances are delegated through fixture outcomes; document final numbers centrally. Do not scatter thresholds across renderer, CLI and server. If one policy cannot satisfy conflicting cases, isolate a new heuristic rather than add semantic AI.

## Visual review

Selection coverage/density only. Compare the contact sheet against the labeled event ledger, then screenshot-critique last. Trail style is already fixed by slice 10.

Follow the exact skill links and non-blocking human review procedure in
[verification](../verification.md#visual-gates). If this slice produces no visual
artifact, retain its machine-readable evidence instead; do not manufacture UI just
for a screenshot gate.

## Stay green and feedback

Keep dependency slices' focused checks green. Update this slice's status/evidence
and the README Next Agent Prompt at each green checkpoint. Tests must pin consumer
behavior, not implementation constants. Run the narrowest relevant checks during
iteration; full-suite closeout belongs to slice 15.

If selection misses a demonstrated emphasis, adjust its own heuristic; do not weaken the recorded workflow or require the user to draw explicit annotations.

