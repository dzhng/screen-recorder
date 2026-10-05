# 07 — Compact transcript reading

Status: implemented; isolated consumer proof passed, live release proof pending. Question: **Can bounded verbatim pages retain exact pointers for explicit edits?**

Dependencies: existing contracts only.

## Contract and owner

Consumer presentation helper over core transcript/projection/pagination.

Input source/generation or project/revision selection and text budget; output grouped phrases, display ranges, exact word/occurrence pins, admitted duration, coverage and continuation. Unknown speakers stay unknown. Rounded display seconds never become edit operands.

## Focused proof and review

A paginated two-take reading artifact.

Test repeats, retimes, partial words, punctuation/UTF8, empty page with continuation and support gaps. Enforce encoded-size budget and stable pages. Preserve raw word truth and immutable generations; absent words do not certify silence.

## Boundaries and decision budget

Inherit the [global contract](../README.md#contracts-and-ownership) and narrow verification policy. Write-tests red/green precedes behavior changes. Existing native output and persisted identity remain unchanged unless this slice names the extension.

Delegate internal naming/decomposition, bounded fixture selection and reversible artifact styling. Public meaning and backend policy are fixed above; resolve a new semantic choice in this spec before coding it. Record actual commands, immutable input/runtime identities, coverage, failures and verdict. User feedback changes requested meaning, supported scope or visible appearance; mechanical preferences alone do not justify expanding the slice. A failed proof remains unfinished and must be narrowed or resliced, not waived.

## Implementation evidence — 2026-10-04

The [consumer helper](../../../skills/screenrec/scripts/compact-transcripts.mjs)
reads only `transcript.get` through the shared bounded CLI boundary. Run its
`--help`, then supply JSON on stdin. It produces a JSON reading artifact with
verbatim service rows, phrase-to-row indexes, pinned identities, admitted duration,
coverage and a resumable continuation. Source and project clocks remain separate;
phrase seconds are presentation only. Unknown speakers stay null.

The output budget counts encoded UTF-8 for the entire artifact, including exact
rows and continuation. An opaque project page cannot be partially consumed safely:
when it does not fit, the helper rereads at the same cursor with a smaller row
limit. Both ordinary pages and these attempts count toward the bounded read budget.
A single oversized row/metadata refuses explicitly rather than truncating evidence.
Continuation metadata preserves revision/generation, duration and coverage across
empty service pages. Unavailable reads remain visible and never prepare speech.

`node --test scripts/compact-transcripts.test.mjs` passes 13 focused cases,
including the command over an isolated scripted CLI, multibyte budget/resumption,
partial and fractional occurrences, gaps, inference segments and generation pins.
These prove consumer orchestration and presentation. They do not establish live
installed-service transcription, speaker recognition or rendered media quality;
those remain production/release gates.

The helper sets the shared `transcript.get` `prepare:false` contract. Existing
callers omitting it preserve automatic source preparation. Source reads inspect
current jobs without queueing ASR; project reads likewise avoid source preparation
while permitting the existing read-only projection-cache job for ready evidence.
The production service contract test with ready model metadata proves both missing
source and project evidence remain unrequested and no transcript job is admitted;
omitted defaults still prepare and return the established word pages. The project
no-preparation assertion was falsified by restoring the prior prepare behavior,
then confirmed green after restoration.

Independent Codex review found a rejected second take could overflow continuation
metadata and exact threshold pauses could merge after floating-point conversion.
Focused regressions now preserve the accepted prefix and pin compact metadata;
pause comparisons use original rational microseconds before display conversion.
The own-review coverage regression preserves first-page occurrence coverage when
subsequent service pages return only a manifest pointer.
