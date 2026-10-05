# 11 — Caption grouping and layout proposals

Status: not started. Question: **Can readable cues be proposed without rewriting speech or applying edits?**

Dependencies: [07](07-compact-transcripts.md).

## Contract and owner

Consumer helper over pinned words and existing text.seed/ordinary text placements.

Caller-selected width/lines/dwell/reading-speed/pause/safe-area parameters return proposed placements and violations. Preserve source pins and editable display text; no forced uppercase or semantic rewrite. Unsupported constraints return violations, not hidden mutation.

## Focused proof and review

Cue proposals and one small rendered caption frame during implementation.

Test corrected text, partial/repeated/retimed words, punctuation, multilingual glyphs and unbreakable words. Judge safe area and legibility within caption crop against plain seed control. Applying placements remains a separate explicit edit.

Retain source/control and candidate shots. Use compare-screenshots to judge the named variable/crop; show useful shots with preview-shots. As the last visual acceptance check, run unprimed screenshot-critique. Human response is a non-blocking chance to redirect reversible choices: allow about five minutes while doing other work, then decide from evidence, record the verdict and close opened shots. Never claim unseen or unheard quality.

## Boundaries and decision budget

Inherit the [global contract](../README.md#contracts-and-ownership) and narrow verification policy. Write-tests red/green precedes behavior changes. Existing native output and persisted identity remain unchanged unless this slice names the extension.

Delegate internal naming/decomposition, bounded fixture selection and reversible artifact styling. Public meaning and backend policy are fixed above; resolve a new semantic choice in this spec before coding it. Record actual commands, immutable input/runtime identities, coverage, failures and verdict. User feedback changes requested meaning, supported scope or visible appearance; mechanical preferences alone do not justify expanding the slice. A failed proof remains unfinished and must be narrowed or resliced, not waived.
