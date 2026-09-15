# 15 — Installed personal workflow and closeout

Status: not started. Dependencies: 00–14.

Read [architecture](../architecture.md), [contracts](../contracts.md), and
[verification](../verification.md) before implementation. Commands below are planned
harness entrypoints to create in this slice, not existing executable claims.

## Contract and API seam

The complete localhost recording→AI inspection→edit→export journey works from an installed local app outside the checkout.

Finish personal install scripts, launch/CLI discovery, storage accounting and manual deletion behavior. Package the app, service code and native workers using the existing host Node24 prerequisite for this personal release; record it in install instructions. No public distribution/updater work. Run the end-to-end verification contract once after focused checks pass.

## Runnable checkpoint

Run bun run lab:personal-release from a clean shell and installed paths with scratch data. Record a real localhost demo containing cursor circle, pause, filler, target phrase and optional browser audio. AI resolves latest, observes processing, reads transcript/index, sees images, retrieves extra frame, cuts, previews, hits stale revision, undoes, exports both, and reopens moved package. Also kill capture, retry failed speech, delete a busy recording, and inspect disk accounting.

## Acceptance

Full local build/format/lint/type/TS/native gates pass once; all mandatory native, model and actual-client evidence exists. Canceled/removed recordings do not return through late jobs. Both export choices remain distinct. Feature is not complete while a required fidelity or real-user recording gate is merely mocked or pending.

## Decisions delegated and scope firewall

Personal install path/naming and concise documentation wording are delegated; required behavior remains fixed. Use code-review and the codex review skill for substantive implementation closeout. Update the handoff and only close/archive the spec when shipped.

## Visual review

Whole-workflow state clarity is the integration variable. Compare reference shots where available and run unprimed screenshot-critique last for final shots. Use preview-shots for a non-blocking user checkpoint.

Follow the exact skill links and non-blocking human review procedure in
[verification](../verification.md#visual-gates). If this slice produces no visual
artifact, retain its machine-readable evidence instead; do not manufacture UI just
for a screenshot gate.

## Stay green and feedback

Keep dependency slices' focused checks green. Update this slice's status/evidence
and the README Next Agent Prompt at each green checkpoint. Tests must pin consumer
behavior, not implementation constants. Run the narrowest relevant checks during
iteration; full-suite closeout belongs to slice 15.

Any failed native/model/client gate remains explicit. Do not expand to tester/public platforms or editing UI to avoid resolving personal-release defects.

