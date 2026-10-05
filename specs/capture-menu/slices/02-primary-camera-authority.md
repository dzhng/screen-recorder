# 02 — Primary camera publication proof

Status: implemented and verified in isolated authority branch; integration waits for slice 01. Dependencies: 01 is the first user-facing checkpoint; this gate has no media-device dependency.

Evidence: [retained primary-camera proof](../assets/evidence/02-primary-camera-authority/README.md).
The deterministic gate passed normal finish, recovery, staged held-byte export,
core publication/evidence admission and catalog reopen. The preservation gates are
green. Physical acquisition and public device identity remain later slices.

## Contract

Prove that camera-primary video can publish, be admitted and recover through the existing primary role without a persisted-format migration. The question is role versus device kind, not live device capability.

## API seam and ownership

Keep primary allocation and layout-2 source.journal.jsonl, primary receipts, and optional narration/system members. Camera-primary journals may identify a camera device, with no companion binding. Companion camera retains layout 1, camera proof members and its bound device identity. Correct CaptureSourcePublication.validateAuthority so role/layout/binding identify authority, rather than equating source.kind camera with companion. MediaRecovery, SourceEvidenceExport and core admission must enforce the same meaning. In particular, SourceEvidenceExport must not route a layout-2 primary camera into companion CameraMedia verification merely because its device kind is camera. CameraMedia remains the layout-1 companion verifier; audit each source.kind camera reader and retain only role-appropriate checks. Reuse CaptureWriter via a general usable-primary-video seam; keep ScreenCaptureKit completeness/geometry checks in its external adapter. Never fabricate screen attachments or relabel a CameraWriter companion receipt as primary.

## Runnable or reviewable artifact

A proposed PrimaryCameraPublicationTests.swift case drives existing prerecorded/asymmetric video fixtures through production primary writer/publication/recovery owners. Retain a small primary journal/receipt/media fixture and readable report under feature evidence; no physical camera opens. This is the earliest proof that the no-migration architecture is viable.

## Verification and what stays green

Test first: primary camera verifies as exactly one primary source; wrong role/layout/source ID, companion binding and foreign authority refuse; recoverable prefixes, source evidence export and normal finish retain original bytes; existing primary-screen and companion-camera fixtures retain their results. Exercise CaptureSourcePublication, MediaRecovery and core capture-publication/admission, not a test-only validator. Preserve IndependentCameraClockTests, IndependentPublicationTests, SourcePublicationRecoveryTests and capture-store reopen behavior. Exit only with primary role proven under the current persisted layouts. If it requires a new format/table or weaker authority, stop this branch and update the spec before proceeding.

This slice requires no visual shot. If a visual artifact is added, declare its variable/crop and apply compare-screenshots where a target exists, then unprimed screenshot-critique as the last visual acceptance check and non-blocking preview-shots review, per [verification.md](../verification.md).

## Delegation and feedback boundary

Private ingress factoring and test fixture plumbing are delegated. The public camera shape is fixed in slice 04. Do not add a camera-only source-name dialect merely to bypass authority checks; role and device kind are separate concepts. Preserve companion origins and host correspondence, including camera pictures preceding the primary origin.

Human feedback changes this slice when it revises the stated contract or reveals a concrete native constraint. Record that change in the owning spec; do not silently absorb it into unrelated work. Routine reversible review does not block implementation. Update the README Next Agent Prompt and this slice's evidence/status before ending a pass.
