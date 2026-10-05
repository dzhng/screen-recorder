# Release key custody

The release identity and Sparkle update key are separate credentials. The first
keeps app signatures stable across builds; the second authenticates the archive
and feed. The [scratch signing lab](../../../../scripts/signing-lab.mjs) proves
PKCS#12 import and certificate-anchored signatures without adding certificate
trust. It never creates a production key or borrows `Screen Recorder Local`.

## Owner handoff

The owner authorized `~/.config/screenrec-release` and the existing repository
secrets on 2026-10-04. The stable release identity and independent updater key
were created there with directory mode 0700 and private file mode 0600. The owner
can copy this folder to a backup location; no off-machine backup is claimed.
A particular volume, device or password manager is not a release gate.
Retain `release-identity.p12`, its public `release-identity.crt`, and
`sparkle-private-key.txt` (the pinned Sparkle-compatible base64 32-byte private seed).
Keep the PKCS#12 password in `release-identity-password.txt` with mode 0600; it
is a private credential alongside the encrypted identity.
Retain the exact certificate; issuing another certificate with the same name
changes the designated requirement. Only public certificate fingerprints and
Sparkle's public key belong in source/receipts.

The approved GitHub repository now holds the three release secrets and their
three public variables. No trust was installed and no personal signing identity
was borrowed. The public identity receipt is [release-identity.json](release-identity.json).
The self-signed certificate uses a ten-year lifetime; retain its exact bytes rather
than recreating a same-named certificate. Private material is absent from source
and receipts.

## Import and CI inputs

Configured secret names in the existing `dzhng/screen-recorder` repository:

| Secret | Contents |
| --- | --- |
| `SCREENREC_RELEASE_IDENTITY_P12` | Base64 encoding of the encrypted PKCS#12 file. |
| `SCREENREC_RELEASE_IDENTITY_PASSWORD` | Its password. |
| `SCREENREC_SPARKLE_PRIVATE_KEY` | Base64 32-byte private seed file contents; its derived public key is validated. |

With owner-supplied files, import these values without printing them. The
following reproduces the authorized transfer, using absolute input files and stdin:

```sh
umask 077
base64 -i "$HOME/.config/screenrec-release/release-identity.p12" \
  -o "$HOME/.config/screenrec-release/release-identity.p12.base64"
gh secret set SCREENREC_RELEASE_IDENTITY_P12 --repo dzhng/screen-recorder \
  < "$HOME/.config/screenrec-release/release-identity.p12.base64"
gh secret set SCREENREC_RELEASE_IDENTITY_PASSWORD --repo dzhng/screen-recorder \
  < "$HOME/.config/screenrec-release/release-identity-password.txt"
gh secret set SCREENREC_SPARKLE_PRIVATE_KEY --repo dzhng/screen-recorder \
  < "$HOME/.config/screenrec-release/sparkle-private-key.txt"
```

Public repository variables accompany those secrets:
`SCREENREC_RELEASE_IDENTITY_SHA1` selects the exact certificate,
`SCREENREC_RELEASE_CERTIFICATE_SHA256` pins its public fingerprint, and
`SCREENREC_SPARKLE_PUBLIC_KEY` pins the updater public key. They derive from the
created credentials; they are not placeholder values. The
[signing owner](../../../../scripts/release-signing.mjs) checks actual certificate/key
bytes against them before signing and owns the input/import contract.

Slice 05 imports the PKCS#12 into a fresh temporary keychain and always passes
that path to `codesign --keychain`. Import allows `/usr/bin/codesign` with `-T`,
not unrestricted `-A`. Select the identity by the public certificate's SHA-1
fingerprint; record its SHA-256 fingerprint for public provenance. An untrusted
self-signed identity is signable this way; do not add trust or require it to appear
in `find-identity -v`. Delete the temporary keychain and secret files in cleanup,
and preserve unrelated account search-list entries.

The measured signing recipe in the lab signs Mach-O executables, then their
nested bundles from inside out, then the outer app, with `--timestamp=none`.
Verify each executable and the complete app with strict verification. Final
packaging must preserve these signatures rather than sign ad hoc afterward.
The relocated scratch probe loads the signed framework and runs the signed Node;
actual updater-helper execution is still the engine/production parity gate.

Sparkle's pinned `sign_update --ed-key-file <private-file>` consumes the separate
private seed file to sign the final archive and then the finalized appcast. It needs no
login-keychain import. Verify that its public key is the one embedded by release
packaging before publishing. No key/certificate trust is installed on recipients.

## Accepted permission prerequisite

The user confirmed on 2026-10-04 that earlier replacement/permission proof is
already sufficient and explicitly asked not to repeat it. Reuse that confirmation
and the [historical signed-copy observation](../../agent-editing/assets/20e-selected-device-probe/follow-up.md)
([raw discovery](../../agent-editing/assets/20e-selected-device-probe/discovery.json))
as the accepted prerequisite. That observation reports existing screen, camera
and microphone grants on its own signed working copy; it is not relabelled as a
new release-certificate or recipient-account test. No new permission/Gatekeeper
checks or account/VM setup are part of this signing pass.
