# Full project audio delivery evidence

The [public journey](../../../../../packages/test-harness/editing/audio-project-large.mjs)
uses mathematically authored, asymmetric stereo PCM and independently verifies its
lossless ALAC encoding before admission. The complete output PCM digest is computed
from the authored signal and dyadic mixing arithmetic; the native renderer is never
used as its own oracle. A periodic signal permits complete comparison without
retaining the large output in memory. Source omission, channel swap and one-frame
shift are explicit negative controls.

The separate excluded-sample comparison uses synthetic capture journals around real
admitted media. Only samples outside acquisition support differ between its sources.
Identical masked output after sample-rate conversion proves those excluded samples
do not affect retained neighbors; unmasked output proves the poison is physically
present. This is not a physical capture or listening test.

Memory measurements sample process RSS, so they cannot establish instantaneous
peaks. Native, service plus delivery CLI, and the sibling MCP adapter have explicit
bounds. The aggregate production and harness trees are also reported for context.
This focused large-file gate does not claim general multi-hour or high-track stress
acceptance. It does not validate lossy codecs or speech models.

Run with an explicit frozen native worker and a new evidence directory:

```sh
SCREENREC_NATIVE=/absolute/path/to/screenrec node packages/test-harness/editing/audio-project-large.mjs --out /tmp/new-project-audio-evidence
```

All service state and gigabyte outputs live in a disposable scratch home. Retained
reports identify the exact runtime hashes. Compact receipts retain failures as well
as successful checks; the first failed run used a closed small-inline MCP lease,
and the second exceeded the shared short-journey poll deadline. The dedicated long
journey has a bounded ten-minute observation deadline; memory and PCM assertions
were not relaxed.
