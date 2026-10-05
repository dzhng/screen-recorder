# 25 — Everyday typed HEVC delivery

Status: not started. Question: **Can HEVC extend delivery without changing established H264/WAV/M4A behavior?**

Dependencies: existing contracts only.

## Contract and owner

Composition output-settings/compiled records; native AVAssetWriter and core rendered receipts/publication.

Add discriminated HEVC settings rather than reusing H264-only profile/entropy/level controls. Prefer native encoder through existing renderer if verified; use pinned FFmpeg only for a demonstrated gap and freeze that recipe. MP4 SDR opaque output; actual capability readiness distinguishes schema support. WAV/M4A stay native.

If the frozen recipe selects FFmpeg rather than the native default, slices 01–05 become mandatory dependencies before production integration. Reference-binary success cannot bypass bundled readiness, input authority or publication.

## Focused proof and review

One tiny imported-footage HEVC export with independent decode/probe.

Delayed audio/B frames/edit lists/rotation/VFR and fractional cuts with landmarks. Verify actual support, A/V alignment, exact authored duration, AAC priming/tail separately, decoded pixels/tags and no blind -shortest. Existing H264 and audio-output preservation gates stay green. Judge matched output frame against native control.

Retain source/control and candidate shots. Use compare-screenshots to judge the named variable/crop; show useful shots with preview-shots. As the last visual acceptance check, run unprimed screenshot-critique. Human response is a non-blocking chance to redirect reversible choices: allow about five minutes while doing other work, then decide from evidence, record the verdict and close opened shots. Never claim unseen or unheard quality.

## Boundaries and decision budget

Inherit the [global contract](../README.md#contracts-and-ownership) and narrow verification policy. Write-tests red/green precedes behavior changes. Existing native output and persisted identity remain unchanged unless this slice names the extension.

Delegate internal naming/decomposition, bounded fixture selection and reversible artifact styling. Public meaning and backend policy are fixed above; resolve a new semantic choice in this spec before coding it. Record actual commands, immutable input/runtime identities, coverage, failures and verdict. User feedback changes requested meaning, supported scope or visible appearance; mechanical preferences alone do not justify expanding the slice. A failed proof remains unfinished and must be narrowed or resliced, not waived.
