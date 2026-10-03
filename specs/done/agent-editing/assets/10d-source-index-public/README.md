# Public source screenshot indexes

The retained source-index routes now pass actual CLI and MCP delivery using the
frozen native worker recorded in [evidence](evidence.json). Run the durable journey
with a frozen `SCREENREC_NATIVE` and:

```sh
node packages/test-harness/editing/source-index-evidence.mjs --out /tmp/source-index-journey
```

The primary journey uses unmodified native probing, scene sampling and source
picture extraction. It covers canceled scene preparation, canceled frame children,
explicit index retry, ordinal and coverage pagination, filter/selection binding,
single PNG delivery and ordered mixed-success batches with duplicate ordinals.
MCP content indexes point to the same PNG bytes delivered by CLI. Both source
tracks also match the independent color-managed reference pixels already used by
the source-frame journey. This is retained-byte and picture-membership verification,
not a new judgment of visual quality. A separate passthrough composition changes
from the first picture to the second within one selected stream. Its mixed batch
matches independent pixels at each ordinal; deliberately duplicated or swapped
images are rejected by that same oracle.

An authored physical short island lies at 50–100ms, while actual scene requests
are 0, 200, 400, 600 and 799.999ms. Its index still selects 50 and 99.999ms. A later
physical interval keeps the short island away from endpoint sampling. This case
uses genuine native edit metadata, with no probe override or private table writes.
The oracle pins exact support gaps and both short-island candidate associations as
unproven coverage; a mutant that calls that unsampled island sampled is rejected.

A public acquisition import uses a synthetic capture journal around real video.
Its index remains tied to that acquisition; dropping the context from the image
reference refuses. The acquisition index survives donor deletion and service
restart. The raw index independently survives project undo/restore/delete. During
the stopped-service fault phase, only scratch derived-cache files are removed: retained source-index generations and bytes remain readable.
The existing source-frame public journey also passes with the shared harness change.
No app was launched, capture made, or audio played.

## Controlled admission boundary

Two additional cases deliberately override only hash-matched probe support in the
test worker. Actual native scene/frame results and public transports remain real.
One declared-empty support case reports `unavailable/no_video`; a declared supported
interval inside a real empty edit completes a zero-image index with explicit
unproven observation coverage. Its exact gap/observation intervals and native
empty-edit receipts are pinned; sampled-equality and missing-receipt mutants fail. Neither is claimed as a natural fully-native probe
admission result. The journal fixture above is likewise not a physical capture.
The harness refuses an inherited override setting so the primary journey cannot
silently inherit a controlled admission boundary.

## Regression and remaining scope

The first live run exposed the [source ordinal-batch delivery refusal](batch-before-fix.txt).
The CLI parser was extended in the separately owned production fix, and the final
journey pins partial failures, duplicate order and content-index associations.

Project screenshot-index projection remains open and must follow the compiler's
frame phase. Public source-index acceptance does not imply project-index readiness,
new crop/overlay rendering acceptance, or any speech-quality result.

The review caught weak temporal-image, island and ready-empty coverage oracles, plus cleanup that could
skip scratch removal after a shutdown error. Independent picture/coverage controls
and unconditional cleanup resolve those findings. The fixture and admission
controls add no production feature or persistent schema.

The final independent review found no actionable issues. It rechecked the saved
coverage against the oracle and rejected additional incorrect-reason mutations;
the reviewer did not rerun the native journey.

## Integrated confirmation

The [root rerun](integrated.json) passes the same actual CLI/MCP/native journey
after integrating the production routes, batch adapter and reviewed harness.
All five corruption controls still reject their mutations. Three actual native
[recording-package preservation cases](integrated-recording-packages.txt) also
pass on the same frozen worker. These checks use Catalog 10 and source picture
implementation v2; future renderer changes require their own confirmation.
