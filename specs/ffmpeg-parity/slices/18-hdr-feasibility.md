# 18 — HDR-to-SDR reproduction

Status: not started. Question: **Can a pinned explicit transform handle selected HDR input families correctly?**

Dependencies: [01](01-lgpl-build.md), [04](04-input-authority.md).

## Contract and owner

Native color policy/asset admission and bounded FFmpeg transform research.

Use actual metadata-bearing PQ/HLG samples, compatible working-space conversion and tone mapping; add libzimg only if needed. If it changes the frozen build, reopen 01 and rerun affected 02–05 proofs before 19. Reference experiments may use a separately identified candidate build; it is never treated as the installed production runtime. Freeze supported metadata/input families and transform parameters. Unknown metadata refuses pending explicit interpretation. Tagging Rec709 alone is never conversion.

## Focused proof and review

Short transformed fixture with color and timing receipts.

Verify linearization, primaries/matrix/range, appearance against independent SDR reference, clipping, rotation once, stream offsets and actual support. Record unavailable local zscale as dependency evidence. Judge highlights/skin/chart regions, not overall editing taste.

Retain source/control and candidate shots. Use compare-screenshots to judge the named variable/crop; show useful shots with preview-shots. As the last visual acceptance check, run unprimed screenshot-critique. Human response is a non-blocking chance to redirect reversible choices: allow about five minutes while doing other work, then decide from evidence, record the verdict and close opened shots. Never claim unseen or unheard quality.

## Boundaries and decision budget

Inherit the [global contract](../README.md#contracts-and-ownership) and narrow verification policy. Write-tests red/green precedes behavior changes. Existing native output and persisted identity remain unchanged unless this slice names the extension.

Delegate internal naming/decomposition, bounded fixture selection and reversible artifact styling. The recipe/provider/build decision is a measured research deliverable; freeze it and its limits in this file before any dependent implementation. Record actual commands, immutable input/runtime identities, coverage, failures and verdict. User feedback changes requested meaning, supported scope or visible appearance; mechanical preferences alone do not justify expanding the slice. A failed proof remains unfinished and must be narrowed or resliced, not waived.
