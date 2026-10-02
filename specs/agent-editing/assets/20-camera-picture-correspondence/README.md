# Retained camera picture correspondence

Status: exact-pixel comparison failed on the first selected picture; the second
prepared request was not dispatched. No physical synchronization gate closes.

The existing source-frame renderer selected the pinned original camera sample
at the saved native time using one ranged reader and one delivered decoded
sample. Its complete pixels differ from the saved full-frame FFmpeg image. Native
and pixel-reader children exited successfully; the producer stopped with exit1
at that inequality. [Verification](verification.json) retains exact sample facts,
complete comparison and unchanged input/runtime pins. No tolerance was introduced.

The historical full-PNG producer has ordinal selection and codec/color output,
but lacks per-picture PTS, complete invocation and executable identity. A separate
gray producer's timestamp cannot fill that missing binding. The historical PNG
and current native PNG also declare different color paths; that fact alone does
not explain the discrepancy. Similar landmarks on direct viewing are observation,
not exact picture identity. Neither same ordinals nor equal native clocks establish
cross-decoder correspondence.

[evidence.tar.xz](evidence.tar.xz) retains fixed requests, replies, producer,
original failure, complete operand manifest and actual terminal records. Full
images and RGBA operands remain in the recorded private cache, with hashes;
private picture content does not enter Git. Original source media and frozen
worker remain untouched; this case explicitly uses the separately pinned staged
worker. The next eligible correspondence experiment must establish the selected
encoded sample's identity and clock before comparing a newly attributed decoded
picture to the historical image. It cannot silently borrow a seek time from the
separate gray run or repeat this failed ordinal comparison.
