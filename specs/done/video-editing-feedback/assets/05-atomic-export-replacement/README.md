# Atomic export replacement evidence

This checkpoint exercises the production publication owner on macOS and the
built public CLI against a scratch service. SRT exports isolate publication from
rendering and transcription. The public fixture substitutes font metadata and
render-workspace disposal only; catalog, jobs, assets, source protection, locks,
receipts and native filesystem operations are real. No user's library, app
installation or source recording is changed.

The production native publication/storage/lifetime subset is built by
[`compilePublicationOwner`](../../../../../helpers/mac/Tests/fixtures/publication-owner.mjs).
`identities.json` records its binary, compiler and source hashes. It is an isolated
publication proof, not a full native/media/capture gate. Root owns the feature's
final full-suite run.

## Reproduce

Build protocol, core, service and CLI with their owning manifests, then compile
outside the checkout and use the resulting path as `YAP_NATIVE`:

```sh
node --input-type=module -e 'import {mkdtemp} from "node:fs/promises"; import {compilePublicationOwner} from "./helpers/mac/Tests/fixtures/publication-owner.mjs"; console.log(await compilePublicationOwner(await mkdtemp("/tmp/yap-publication-owner-")));'
YAP_NATIVE=/absolute/path/to/publication-owner node --test helpers/mac/Tests/publication.test.mjs apps/service/tests/publication.mjs apps/service/tests/export-replacement.mjs
```

Node's `--test-name-pattern` selects an individual case. `YAP_EXPORT_EVIDENCE`
names an existing directory when accepted public request/result exchanges should
be retained. The test fixtures remove their scratch media and close their service.
The explicitly compiled binary directory remains caller-owned.

## Claims and limits

`public-owned-replacement.json` retains old/new hashes, receipt identities and
accepted public exchanges. `public-external-conflict.json` shows a real syscall
race: new bytes are visible, no receipt is committed, `job.get` reports uncertain
destination visibility and the displaced foreign bytes remain through recovery,
retry and refused abandonment. `public-external-symlink-conflict.json` additionally proves aggregate storage
remains readable and ignores growth of the external referent while retaining
the link. Native accounting pins its own metadata length exactly. Fault injection interposes the actual
`renameatx_np`; production has no test switch.

The native and public tests own the case assertions. Retained red logs show that
removing authorization, overwrite replay identity, destination locking, digest
comparison or unknown-displacement cleanup refusal fails for the expected reason.
The initial unsupported replacement, overwritten imported original, hardlink
accounting, marker-only interrupted cleanup, lost uncertainty detail and pinned
victim deadline each have red/green proof. Native tests additionally kill the
actual publisher immediately before/after swap, race a final symlink and retain
a foreign successor without rollback. Imported-source protection is exercised
through a renamed original and a hardlink alias.

The old output remains intact before commit. Admission/precommit reject a
symlink. A same-user external writer that ignores the lock can inject one at the
syscall: the kernel swaps the link, leaves its referent untouched, and the owner
retains it as a conflict. This is an explicit platform limitation, not a
race-proof claim. Power-loss durability and unrelated media quality are outside
this checkpoint.

`final-focused.log`, `historical.log` and the type/budget logs record narrow
results. [`review.md`](review.md) records the closeout lenses and independent
review disposition; [`choices.md`](choices.md) gives parent-owned ledger inputs.
