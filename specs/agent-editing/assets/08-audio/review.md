# Native audio pass review

Shape: source opening and rate conversion are shared with recording playback;
composition schedules own independent clips, and one WAVE writer owns float output
and publication. Repeated occurrences share immutable opened source metadata but
keep separate decoding cursors. No second project document or editing reducer was
introduced. Source context is supplied by the compiler, not inferred from neighbors
inside the worker.

Independent Codex review identified a retained-origin mismatch: selecting and
placing [1,1000000) microseconds gives a zero affine offset, but ceiling the first
source sample and flooring the output origin can shift/exhaust PCM. The real
native harness reproduced `NATIVE_DECODE_FAILED`; the checkpoint explicitly fences
that unsupported origin with `NOT_READY` before output creation. General origins
must be reconciled against the frozen nearest-start source-selection policy in
the next contract pass. This resolves the admitted-input failure without claiming
full baseline readiness. Other pending gates are recorded in the evidence README.

Tests: complete native composition harness passes after the fence. Disabling the
real output gain and broadening the real filter support each produce the intended
red result; restoration passes. Existing native audio preservation checks pass
after the shared source/WAVE changes and scalar loop optimization. Source/header
checks, CLI adapter lint and patch whitespace checks pass. The user library and
speaker output were not used.

Docs: the native README and slice08 link the evidence, distinguish native execution
from public live journeys, and leave the baseline phase/quality gates open.

## Fractional phase reconciliation

A second scoped Codex review found no actionable correctness findings in the
native nearest-start / ceil-end addressing, full-run output origin, and bounded
synthetic endpoint padding changes. Its sandbox could not start AVAssetReader;
that runtime attempt is inconclusive. The independent production-entry run and
recording preservation run are the execution evidence, not that review attempt.

The source reader must reach its declared selection end before padding is allowed.
Padding is limited to the arithmetic deficit between owed output frames and the
selected native frame count converted to output rate. It cannot conceal a short
physical decode or read the next excluded source frame. The recording caller's
padding budget remains zero.
