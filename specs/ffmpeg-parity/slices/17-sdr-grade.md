# 17 — Typed SDR correction

Status: complete, with bounded fixture and numerical proof. Question: **Does one declared grade behave consistently across picture consumers?**

Dependencies: [16](16-sdr-feasibility.md).

## Contract and owner

Composition ordered processor/compiler and native shared picture executor; retained LUT assets only if proven necessary.

Implement the frozen modest correction recipe; native preferred when adequate, no duplicate default implementation. Bind any immutable LUT by asset identity. Preserve existing orientation/geometry/order and exact sampling.

If the frozen recipe selects FFmpeg rather than the native default, slices 01–05 become mandatory dependencies before production integration. Reference-binary success cannot bypass bundled readiness, input authority or publication.

## Shipped contract and evidence

The static `sdr-correction` processor uses the frozen 16 recipe and parameter
bounds. It participates in ordered clip/track/group/output processing; curves and
temporal windows refuse. Native picture discovery returns the actual provider/OS
identity. The shared executor serves inspection and movies; alpha and extended
working values retain the measured recipe. Source profile admission stays unchanged.

The recipe is incorporated into existing frame/movie implementation identities,
which already own cache keys, queued jobs, export snapshots and replay validation.
An OS recipe change conservatively invalidates ungraded picture/movie caches too.
Prior bound jobs and intents refuse rather than silently choosing a new recipe.
No new storage format, backend switch or compatibility path is introduced.

[Public fixture](../../../packages/test-harness/editing/sdr-correction.mjs) and
[numerical production tests](../../../helpers/mac/Tests/ScreenRecorderFrameTests/SDRCorrectionTests.swift)
retain their distinct claims. [Evidence](../evidence/sdr-execution/proof.json)
proves exact identity and frozen exposure/saturation picture parity, historical and
bypassed/repeated pictures, missing/wrong native recipe refusal without output,
and matching preview/export pixels with existing H.264 error (MAE 0.567/255 here).
Seventeen focused composition and five service checks and affected typechecks pass.
No whole-suite or installed-release claim is made.

Independent code review found a real durable recipe gap; an OS-change probe
reproduced identical preview pins. After binding through implementation identity,
its follow-up verified changed cache/job inputs and `NOT_READY` at old job admission
and execution. Its sandbox could not establish native GPU pixels; actual host
numerical and public output checks supplied that proof separately.

Fresh visual critique saw stable geometry and no introduced encoding fringe.
Dark top/left bands already existed in control. The tiny black-background fixture
cannot establish arbitrary alpha backgrounds, natural-scene clipping, temporal
quality or calibrated-white accuracy. All nine reviewed PNGs remain byte-identical
after the metadata/transport fixes. Saved and inline comparisons were shown; no
new Preview batch was opened while earlier owned-document cleanup remains uncertain.
A direct-worker refusal probe initially failed to send stdin; that owned process
was retired and the harness now uses bounded synchronous invocation.

## Focused proof and review

A processor fixture with matched frame/preview/export shots.

Identity unchanged; processor ordering, repeated occurrence, alpha edge and clipping tests. Compare inspection/preview/movie within documented encode tolerance. Judge only changed color patches and alpha edges; existing layout is control.

Retain source/control and candidate shots. Use compare-screenshots to judge the named variable/crop; show useful shots with preview-shots. As the last visual acceptance check, run unprimed screenshot-critique. Human response is a non-blocking chance to redirect reversible choices: allow about five minutes while doing other work, then decide from evidence, record the verdict and close opened shots. Never claim unseen or unheard quality.

## Boundaries and decision budget

Inherit the [global contract](../README.md#contracts-and-ownership) and narrow verification policy. Write-tests red/green precedes behavior changes. Existing native output and persisted identity remain unchanged unless this slice names the extension.

Delegate internal naming/decomposition, bounded fixture selection and reversible artifact styling. Public meaning and backend policy are fixed above; resolve a new semantic choice in this spec before coding it. Record actual commands, immutable input/runtime identities, coverage, failures and verdict. User feedback changes requested meaning, supported scope or visible appearance; mechanical preferences alone do not justify expanding the slice. A failed proof remains unfinished and must be narrowed or resliced, not waived.
