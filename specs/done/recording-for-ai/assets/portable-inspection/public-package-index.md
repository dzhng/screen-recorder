# Public package admission and retained index inspection

The public boundary uses the existing operation registry, index reader and typed
media delivery owner. A generated no-narration ZIP is admitted by the real service;
the CLI and MCP SDK receive its retained PNG bytes. This proves transport and
lifetime behavior, not an AI model's understanding of the image. Arbitrary package
frame/audio requests are still outside this checkpoint.

## Verified behavior

The generated fixture exports an older revision while including newer history.
Default revision/index reads keep that pin; explicit history reads can select an
included revision, but cannot invent an index for it. Two opens of the same ZIP
have independent handles, continuations and delivery lifetimes. CLI single-image
output and MCP single/batch image bytes match the retained inventory; ordered batch
failures preserve the other images.

A same-ID library deletion leaves both package deliveries readable. Closing one
admission revokes its delivery before the real expiry deadline while the sibling
still reads. Service restart rejects old admission IDs, handles and delivery
tokens. Every owned service process group is absent after graceful shutdown.

A socket client discards an open reply without parsing its admission ID. Public
status discovers that existing resource, and close reclaims it without restart or
content deduplication. A correctly hashed malformed normalized page passes archive
admission and returns INVALID_EVIDENCE on read. Missing archive input and an
invalid package root return explicit errors; the latter leaves library operations
available. The service root also works through the ordinary `/tmp` alias while
matching its admitted directory identity.

## Regression evidence and scope

The public generated-media gate lives in
[package-public-index.mjs](https://github.com/dzhng/screen-recorder/blob/cc5d7a9fee578758eeadffe662eff0778556d7df/apps/macos/tests/package-public-index.mjs).
It shares the existing relocation generator and archive fixture rather than
constructing fake library rows for package reads. Its separate same-ID library
fixture seeds canceled background work so this inspection test does not request
unrelated analysis. Source/archive bytes remain unchanged.

Deliberately selecting the newest revision failed the exported-pin assertion.
Deliberately assigning package deliveries to the recording namespace failed the
close-revocation assertion (CONTEXT_CLOSED instead of ARTIFACT_EXPIRED). Both changes
were restored before the combined native gate. The shared reader's foreign-target
continuation mutation also failed its focused core test.

The focused native matrix passed **14 tests**, covering the public route, retained
ZIP/native parity and the internal registry. [Native receipt](public-package-index-native.txt),
[pinned-revision regression](public-package-index-pinned-red.txt) and
[delivery-owner regression](public-package-index-owner-red.txt) retain those results.
The final [release-worker public gate](public-package-index-release.txt) passed
against the freshly built bundled helper; its [compact receipt](public-package-index.json)
records native/image/archive hashes. The merged [core](public-package-index-core.txt)
suite passed 316 tests, [service](public-package-index-service.txt) 98,
[CLI](public-package-index-cli.txt) 21 and [protocol](public-package-index-protocol.txt)
11. Workspace build (8 tasks) and types (11 tasks) passed. Independent Codex review
found no actionable regression; its service socket tests were sandbox-blocked,
so the unrestricted runs above supply actual socket/native evidence. Lint has only
two existing unsafe-finally warnings in the workspace-recovery fixture; changed
production files are clean.

Run the optional native gate against an explicitly selected built helper:

```sh
SCREENREC_NATIVE=/absolute/path/to/screenrec-native \
  node --test apps/macos/tests/package-public-index.mjs
```

The test initially exposed a real adapter assumption that every image batch has a
recording ID; the shared batch consumer now accepts the package target too. Earlier
setup failures involved canonical input paths, Unix socket length, an undefined
JSON test field, and the fixture's stale error-code expectation; these were harness
corrections, not native containment failures.
