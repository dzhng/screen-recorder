# 02 — Prove signing and permission boundaries

Unlock: a documented release-signing recipe and honest macOS permission behavior
without an Apple Developer membership. Depends on 01; reuse its frozen updater.

## Seam and artifact

The existing [signing owner](../../../scripts/signing-identity.mjs) is for personal
source installs. Do not borrow the user's local identity as a distribution key.
The release recipe consumes a stable self-signed code-signing identity plus the
independent Ed25519 key. Outputs are verified nested/bundle signatures, designated
requirements and observed permission state, not a certificate-name assertion.

Use disposable app locations and an isolated test account/VM or explicitly approved
scratch identity. Temporary signing material remains outside source and reports.
No TCC reset, user-keychain trust change or user-library operation is allowed.
Missing macOS approval/setup is recorded as unverified; portable work can continue.

Human artifact: an observation report for ad-hoc A→stable B bootstrap and stable
B→C replacement, with final nested-code recipe, quarantine state, exact OS and
before/after screen/microphone access. Include an explicit minimal capture only
if preflight facts cannot settle whether an existing grant remains usable.

## Proof

- Final assembly/signing includes Node, native executables, Sparkle framework and
  helpers; verification and relocated helper execution pass without paid signing.
- Stable identity/designated requirement is preserved across B→C, and the actual
  old/new permission state is measured. Bootstrap may differ; record it separately.
- Quarantined downloaded app behavior is observed on a recipient-like account,
  not inferred from trust on the build machine.
- Ordinary launch/update relaunch does not request permissions or start capture.
- Release and personal-source bundle identities remain distinct.

Use slice 01's minimal fixture; no transcription/render/model run answers this
question. Retain public certificate fingerprint and signing-command/config identities,
never private material. Packaging must not later overwrite the result ad hoc.

## Verdict and freedoms

A stable self-signed identity is the selected approach; permission continuity is
OPEN until measured. If macOS needs reapproval, document the exact bootstrap/repeated
update behavior and reopen any silent-continuity claim. Do not quietly require a
paid Apple account. Separate update authentication from Gatekeeper and TCC outcomes.

Delegated: scratch certificate label, evidence presentation and isolated test
setup within authorized state. Production key custody is not delegated to silent
creation: prepare an exact backup/import/CI-secret handoff for implementation.
Keep existing personal-install behavior green. Human feedback can change the
handling of measured recurring reapproval, not replace evidence with an assumption.
