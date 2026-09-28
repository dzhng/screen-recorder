# Live acquisition adoption

The journey in
[the executable harness](../../../../packages/test-harness/editing/source-acquisition.mjs)
uses actual CLI children and MCP stdio, the project service and a frozen native
worker. It copies the real narrated-workbench capture to a scratch donor; it does
not manufacture journals, probes, media, database rows or native replies.

The fixture service can hold a successful native reply before returning it to the
production importer. Cancellation follows actual source-evidence export. A later
attempt is killed after its second media probe, when the first asset is already
published and referenced and normalized evidence is indexed. Before retry, the
journey verifies that startup removed the abandoned evidence rows, asset references
**and attempt files**. Retry uses the same admitted request and a fresh generation.

Two independent adoptions of the same captured bytes and journal preserve identical
bindings. Deleting the donor leaves immutable metadata, retained raw journal hashes,
media and replay usable. Both CLI and MCP read the same metadata. Requests with the
same ID and another path conflict.

The resulting project renders a real two-second narration/picture excerpt with
context A, context B and physical-only selection. The excerpt is chosen inside
common captured support and aligned using each asset's source-clock offset.
Decoded pictures and PCM match across all three; the samples contain nonzero
narration energy. Omitted context replacement, undo, pinned export, service restart
and historical revision reads are exercised through public operations. Exported
bytes equal the pinned preview.

These two contexts have the **same journal and support**. This does not prove the
separate differing-mask/hole/partial-word journey. It also does not prove selected
stream transcription, improved ASR timing, listening quality or new visual quality.
Those remain open under 10b and later slices.

## Verification and failures

[The final report](report.json) records assertions, public calls and hashes of the
actual native executable and relevant built modules, including the harness itself.
It was run against the parent-owned acquisition implementation snapshot using
Catalog6 and the replacement omission fix. Those production files are not part of
this harness commit.

The original [production failure](omitted-binding-production-report.json) caught
`edit.apply` returning an invalid result after committing an omitted-context
replacement. The parent fixed the explicit `undefined` property; the final journey
passes that operation and undo. [Earlier harness failures](harness-failures.txt)
are retained separately and did not change the product's acceptance thresholds.

[Independent review](review.txt) found missing filesystem cleanup assertions and a
teardown failure that could exit successfully. Both were fixed.
[Real journey mutations](mutation-results.json) demonstrate that retaining orphan
files fails before retry, and an injected final teardown failure preserves its
report while exiting nonzero. Production and harness mutations were restored
before the canonical final run.

Run after building the TypeScript packages, with an isolated native binary:

```sh
SCREENREC_NATIVE=/absolute/path/to/screenrec-native \
  node packages/test-harness/editing/source-acquisition.mjs --out /new/evidence/directory
```

All service children close before the scratch home is removed. Evidence media
remain in the output directory; no installed app, new recording or playback is used.
