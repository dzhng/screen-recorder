# 10 — Read-only loudness measurement

Status: not started. Question: **Does the report identify and measure the exact requested signal?**

Dependencies: [05](05-managed-output.md).

## Contract and owner

Shared proposed audio.measure operation; core audio-inspection selection and measurement evidence; FFmpeg analyzes retained PCM.

Request pins assetId/streamId, optional acquisitionId and admitted support, or project/revision/tap plus prepared-signal recipe identity; window, channel interpretation and true-peak mode. Result records LUFS/LRA/peak, algorithm/version, exact coverage and not-measurable states. No implicit treatment. Whole-program versus excerpt semantics are explicit. An integrated selection spanning unavailable support is refused with coverage and available sections; never concatenate fragments or insert measured silence. Explicit authored silence remains signal. Mono is measured as its admitted single channel by default; dual-mono playback interpretation is opt-in and reported. Silence or inadequate gating duration reports not-measurable rather than a fabricated finite target.

## Focused proof and review

A CLI JSON reading and calibration result.

Independent BS1770/R128 reference signals, silence, too-short/gapped selections, mono/dual-mono, stereo and intersample peak. Explicit peak=true/libswresample; parse nonfinite/numeric-string stats safely. Freeze tolerance from independent oracle before held-out tests; RMS is not LUFS.

## Boundaries and decision budget

Inherit the [global contract](../README.md#contracts-and-ownership) and narrow verification policy. Write-tests red/green precedes behavior changes. Existing native output and persisted identity remain unchanged unless this slice names the extension.

Delegate internal naming/decomposition, bounded fixture selection and reversible artifact styling. Public meaning and backend policy are fixed above; resolve a new semantic choice in this spec before coding it. Record actual commands, immutable input/runtime identities, coverage, failures and verdict. User feedback changes requested meaning, supported scope or visible appearance; mechanical preferences alone do not justify expanding the slice. A failed proof remains unfinished and must be narrowed or resliced, not waived.
