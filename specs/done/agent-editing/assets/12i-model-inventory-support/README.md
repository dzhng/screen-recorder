# Model-root-relative inventory support

This bookkeeping correction applies to current reusable research tooling only.
The completed alignment case and every frozen runner/result/manifest remain
unchanged. Its original empty inventory and failed producer exit stay historical
facts; independently retained model/runtime pins qualify that result separately.
No alignment, recognition, voice, media or preparation run belongs to this pass.

The inventory excludes a `.cache` component only below the caller's declared
model root. Putting the model under a user's `.cache`, an HF snapshot directory
or a model root itself named `.cache` must retain the same relative filenames,
sizes and SHA256 values. Model-internal `.cache` metadata stays omitted.

The [shared owner](../../../../../packages/test-harness/editing/model_inventory.py)
serves the existing alignment, verbatim and voice research entries. Their direct
script paths remain repository entrypoints and independent of caller cwd. If
copying a current entry, preserve the editing directory layout and its shared
owner; it is not a standalone frozen artifact. The voice runtime assembler uses
the separate `helpers/voice/worker.py`, so that packaging and its retained copies
do not change.

The [filesystem regression](../../../../../packages/test-harness/editing/test_model_inventory.py)
uses tiny synthetic files and literal expected hashes. The extracted original
absolute-path filter failed the ancestor-cache and root-named-cache cases; the
corrected owner passes them, including file links into HF-style blob storage.
Actual direct-script import controls run from an unrelated cwd using isolated
standard-library Python and stop before any model library loads. Existing
list/dictionary receipt shapes remain; future receipts also pin the introduced
inventory helper's SHA256 beside the entry script.

[Verification](verification.json) binds the compact evidence packet, complete
commands/output, source identities and frozen-file preservation. The final
three-test gate, Python syntax check and whitespace check passed; all test
children terminated. [Review](review.md) and [choices](choices.md) record the
scope and introduced dependency. Root owns the alignment result, shared hubs
and integration. This metadata fix supplies no new speech-quality or adoption
claim.

Run the focused standard-library gate from the repository root:

```sh
python3 -I -B -S -m unittest discover -s packages/test-harness/editing -p test_model_inventory.py -v
```

Root [merged verification](merged.json) checks the exact packet/current sources and repeats only the standard-library filesystem/import gate.
