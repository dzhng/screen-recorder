# 02 — Prove signing and preserve accepted permission behavior

Unlock: a documented release-signing recipe without an Apple Developer membership.
Use the frozen engine for final package/helper parity; independent scratch signing
can establish the certificate and restoration boundary beforehand.

## Seam and artifact

The existing [signing owner](../../../scripts/signing-identity.mjs) is for personal
source installs. Do not borrow the user's local identity as a distribution key.
The release recipe consumes a stable self-signed code-signing identity plus the
independent Ed25519 key. Outputs are verified nested/bundle signatures and
certificate-anchored designated requirements, not a certificate-name assertion.

Use disposable app locations and explicitly authorized scratch identities.
Temporary signing material stays outside source and reports. No user-keychain
trust change, TCC reset, permission request or user-library operation is allowed.
The user confirmed on 2026-10-04 that previous permission continuity proof is
sufficient and explicitly directed us not to repeat recipient permission or
Gatekeeper testing. [The custody handoff](../assets/signing-custody.md#accepted-permission-prerequisite)
records this accepted prerequisite and the historical evidence's original scope.

Human artifact: a public signing/restore receipt and the exact prepared
backup/import/CI-secret handoff. Do not create production credentials silently.

## Proof

- Final assembly signs Node, native executables, Sparkle framework and helpers
  from inside out; strict nested/bundle verification and relocated helper
  execution pass without paid signing. Packaging preserves those signatures.
- Changed B→C bundles preserve the same certificate-anchored requirement, including
  after restoring the encrypted PKCS#12 into another temporary keychain. A different
  certificate and tampered nested code fail their corresponding checks.
- Ordinary launch/update relaunch requests no permissions and starts no capture;
  the native integration owns this behavior, without another recipient grant test.
- Release and personal-source bundle identities remain distinct.

Retain public certificate fingerprints and signing-command/config identities,
never private material. Updater authentication is separate from app-signature
identity; the owner-approved custody is recorded below.

## Signing checkpoint

[Public scratch evidence](../assets/signing-boundary.json) establishes the
inside-out signing and encrypted PKCS#12 restore recipe using the selected
framework and real Node input. B and changed C retain one certificate-anchored
designated requirement; a different certificate, ad-hoc bootstrap requirement
and tampered nested Node fail the corresponding checks. Relocated C loads the
framework and runs Node. This does not prove an installer-helper update cycle or
production packaging parity. The [lab](../../../scripts/signing-lab.mjs) contains
no permission calls.

The [custody handoff](../assets/signing-custody.md) records the owner-approved
private folder and configured GitHub secrets. The stable identity and separate
update key are provisioned, with [public fingerprints](../assets/release-identity.json).
Release packaging now consumes those durable inputs and the assembled installed
fixture exercises signed helper execution. Final published-artifact verification
remains in slice 09; repeated permission checks are removed. The positive fixture
uses an isolated signing identity and does not relabel itself as a recipient
permission observation.

## Verdict and freedoms

Stable self-signed identity remains the selected approach. The earlier permission
behavior and user's confirmation are accepted; this scratch signing checkpoint
makes no new recipient/capture claim. No paid account is required.

Delegated: scratch certificate label, evidence presentation and isolated signing
setup. Production key custody is not delegated to silent creation. Keep the
existing personal-install behavior unchanged. Packaging must not overwrite the
measured stable signatures with ad-hoc signatures.
