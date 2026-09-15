# 14 — Two exports and relocated AI inspection

Status: not started. Dependencies: 08, 11, 13.

Read [architecture](../architecture.md), [contracts](../contracts.md), and
[verification](../verification.md) before implementation. Commands below are planned
harness entrypoints to create in this slice, not existing executable claims.

## Contract and API seam

Human video and a complete AI package are stable exports of one revision, and the package can answer new frame requests elsewhere.

Implement video/package export jobs, atomic staging/publish, manifest inventory/hashes, relative paths, edit history and pinned evidence. Reuse slice 13 renderer. Implement read-only package open/close with the same inspection core and native decoder, package-cache extraction bounds and unsafe-path rejection. Wire the two previously unavailable menu export actions and verify their completion/failure states. No general library import/merge or third format.

## Runnable checkpoint

Run bun run lab:exports. Export while another edit runs, and request a package before transcription is ready to prove prerequisite waiting does not hold the heavy-worker slot. Move both outputs out of the library, make the original root unavailable, open the package, inspect transcript/index/history and request a previously unselected frame/trail near a scene transition through both adapters, without the original scene-analysis cache. Test interrupted source and no-narration packages, failed required transcript, partial export termination and unsafe archive paths.

## Acceptance

Video plays the pinned current edit; package distinguishes original/source from edited projection and has no absolute-library dependency. A failed required artifact doesn't become a complete package. Moved package arbitrary frame agrees with pre-export evidence. No runtime/model weights are bundled; Mac CLI is the validated reader.

## Decisions delegated and scope firewall

ZIP implementation/compression and inventory traversal internals are delegated with path/size validation. File format semantics are fixed in contracts.md. The read-only package reader consumes the same projection routines as the library.

## Visual review

Export parity/readability only. Compare relocated-package frames with original inspection at identical parameters, then screenshot-critique last. Audition exported video around cuts.

Follow the exact skill links and non-blocking human review procedure in
[verification](../verification.md#visual-gates). If this slice produces no visual
artifact, retain its machine-readable evidence instead; do not manufacture UI just
for a screenshot gate.

## Stay green and feedback

Keep dependency slices' focused checks green. Update this slice's status/evidence
and the README Next Agent Prompt at each green checkpoint. Tests must pin consumer
behavior, not implementation constants. Run the narrowest relevant checks during
iteration; full-suite closeout belongs to slice 15.

If package inspection needs the original library, the portability gate fails; don't call a folder of selected screenshots a complete package.

