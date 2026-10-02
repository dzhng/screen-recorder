# Choices

## Shared helper dependency — sound, high confidence

**When:** Current reusable model-inventory correction, based on `fba91e05`.

**Choice:** Put the inventory and its file hashing in one standard-library module
at the editing directory shared by the three repository research entries. When
an alignment script is launched from another directory, it locates that parent
from its own filename and imports the same owner used by verbatim recognition
and voice reproduction. Three local fixes would let the exclusion rule drift;
an installed Python package would introduce new setup for existing direct
scripts. The helper also owns file hashing already needed by each entry.

**Gap:** The task required one computation and working direct entrypoints, but
did not choose the helper location or how the new dependency appears in future
evidence receipts. A receipt now records the helper's SHA256, a digest of its
complete bytes, alongside the entry script's digest: pinning only the entry
would otherwise leave the computation unpinned.

**Reach:** A future copy of a current repository entry must include the shared
editing-directory helper and preserve that layout. Frozen standalone evidence
runners remain separate immutable artifacts. No installer, fallback alias,
general launcher or production dependency is introduced.

**Verdict:** Sound. Current callers invoke repository entries in place; the
separate voice worker assembler does not package these scripts. Isolated import
controls prove cwd independence before any model runtime loads.

**Confidence:** High. This preserves the current execution architecture while
giving the shared evidence rule one owner.

The relative exclusion rule, unchanged historical artifacts and prohibition on
model reruns were explicit task requirements, not discretionary choices.
