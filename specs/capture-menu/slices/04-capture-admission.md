# 04 — Canonical capture selection and permission contract

Status: TODO. Dependencies: 02 for primary authority viability.

## Contract

Unlock one camera-primary request meaning through protocol, service, native decoding and controls. Resolve camera discovery and explicit permissions before device acquisition.

## API seam and ownership

Extend the strict source discriminant with {kind: camera, deviceId: bounded nonempty stable ID}. Retain top-level cameraDeviceId exclusively for an optional companion on screen/region sources; refuse it on a camera primary. UI may represent an incomplete camera choice, but start emits no request until an explicit device is selected. Camera Only allocates the ordinary primary source/directory with recording.camera=null and publication.camera=null. Include source.deviceId in CaptureService allocationArguments so changed devices under the same request ID conflict. Keep old canonical arguments unchanged for existing source kinds and durable replay receipts. Mirror the contract in ControlsState Start.Source, native CaptureSource and cross-language fixtures. Every caller derives admission/help from the operation catalog; no CLI/MCP private camera parser.

## Runnable or reviewable artifact

Protocol/native fixtures and a service request/response report show valid camera-primary selection, malformed/conflicting selection and durable replay. Camera/microphone discovery remains available with screen access denied. Permission UI fixtures show camera Allow versus System Settings actions without requesting access.

## Verification and what stays green

Invoke write-tests. Extend protocol index.test.ts/cross-language fixtures, controls SelectionTests.swift and SettingsTests.swift, service capture.test.ts and core capture-store.test.ts. Test exact device identity, companion conflict, unknown fields, replay after reopen, changed camera conflict, no companion allocation, old recordings readable, and old screen-plus-camera allocations unchanged. Discovery/status/menu open never prompt. Return honest empty screen arrays only for absent screen authorization; real screen enumeration failures remain errors. Add camera to PermissionKind/ControlsAction and NativeCapture.requestPermission, refresh on return from Settings. If Settings permission rows change, take prior/candidate offscreen Settings shots and run compare-screenshots, then unprimed screenshot-critique as the last visual acceptance check, followed by non-blocking preview-shots review per verification.md. Update camera usage-description wording and inspect actual bundle/signing requirements without speculative entitlement changes.

This slice requires no visual shot. If a visual artifact is added, declare its variable/crop and apply compare-screenshots where a target exists, then unprimed screenshot-critique as the last visual acceptance check and non-blocking preview-shots review, per [verification.md](../verification.md).

## Delegation and feedback boundary

Internal type/file names and generated help formatting are delegated. Public shape, mutual exclusion, defaults and replay semantics are fixed. Discovery does not select or open a camera. Reuse the last explicitly selected available device during this app session if still selected; never choose the first discovered camera or silently substitute a disconnected one. No new persisted camera default is required. Camera selection unavailable to the backend must fail honestly until its acquisition slices pass.

Human feedback changes this slice when it revises the stated contract or reveals a concrete native constraint. Record that change in the owning spec; do not silently absorb it into unrelated work. Routine reversible review does not block implementation. Update the README Next Agent Prompt and this slice's evidence/status before ending a pass.
