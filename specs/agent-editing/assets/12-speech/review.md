# Review

Shape: one reproduction entry point reuses the existing model owner, native ASR
and native audio operation. A small scorer owns comparisons against independent
marks; a separate saved-artifact verifier checks PCM. No service, public API,
editorial policy, production engine change or second model store was introduced.
Scratch preparation is deliberate and no runtime downloads occur during reads.

Diff: checked source/container clock distinction, journal continuity, model pins,
explicit output paths, bounded worker lifetime, missing/ambiguous mark handling,
and full sample counts. The worker uses sourceOffsetUs zero because the captured
MOV already carries source time; source acquisition starts at 48,675 µs. Marks
remain source times throughout. Exact match against all inherited word ranges
confirms this mapping in the observed run.

Tests: three scorer checks pass after the first was red without its implementation.
They pin independent mark ownership, clipping direction, unknown annotations,
missing/ambiguous evidence and shifted candidate errors. The two actual native
cuts pass hash/count/retained-PCM checks. Source labels were not modified, and the
two regenerated panels match the historical bytes. Node syntax/lint and whitespace
checks pass. This harness-only change does not claim new production preservation
coverage from unrelated tests.

Docs: the slice links to the evidence and runnable checks; README and choices at
the feature root remain with their owner. The packet discloses all missing labels,
failed timing targets, model warnings and unresolved listening/visual gates.
No audio was played, no model output was used as semantic ground truth, and no
private-library scan was performed. Clean bounded checkpoint; slice incomplete.
