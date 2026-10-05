# 09 — Read-only revision review bundle

Status: complete. Question: **Can changed output be reviewed with reproducible bounded coverage?**

Dependencies: [08](08-timeline-inspection.md).

## Contract and owner

Consumer helper over authored revisions/diffs/cuts and existing preview/inspection owners.

Explicit revision or pair and coverage budgets return joins with context, opening/ending, overlay entrances and selected middle windows; artifacts include exact identities and requested/observed/skipped checks. Automated checks supply facts, not taste verdicts.

Public metadata does not expose resolved whole-revision duration. Require explicit
per-revision review extents with caller provenance and label opening/ending as
selection boundaries. Do not infer an extent from authored attachment fields or
prepare a whole-revision index. Text entrances use owner-produced cut sides;
caller-selected overlay windows cover other known entrances. Processing-driven
entrances that lack canonical timing evidence stay unobserved. This narrowing is
intentional and was accepted during implementation. It adds no clock interpreter
or public operation.

## Focused proof and review

A small before/after evidence bundle using explicit fixture operations during implementation.

Distinguish identical split from mapping change; pin revisions despite concurrent edits. Include missing audio/picture/transcript evidence honestly. Actual listening is needed for sound claims. No modification by the read operation. Judge join context and evidence readability, not editorial selections.

Retain source/control and candidate shots. Use compare-screenshots to judge the named variable/crop; show useful shots with preview-shots. As the last visual acceptance check, run unprimed screenshot-critique. Human response is a non-blocking chance to redirect reversible choices: allow about five minutes while doing other work, then decide from evidence, record the verdict and close opened shots. Never claim unseen or unheard quality.

## Boundaries and decision budget

Inherit the [global contract](../README.md#contracts-and-ownership) and narrow verification policy. Write-tests red/green precedes behavior changes. Existing native output and persisted identity remain unchanged unless this slice names the extension.

Delegate internal naming/decomposition, bounded fixture selection and reversible artifact styling. Public meaning and backend policy are fixed above; resolve a new semantic choice in this spec before coding it. Record actual commands, immutable input/runtime identities, coverage, failures and verdict. User feedback changes requested meaning, supported scope or visible appearance; mechanical preferences alone do not justify expanding the slice. A failed proof remains unfinished and must be narrowed or resliced, not waived.

## Implemented evidence contract

The consumer [helper](../../../skills/screenrec/scripts/review-bundle.mjs) owns
its executable settings in `--help`. It consumes pinned public revision and event
owners and reuses the existing bounded timeline inspection helper. Selected
boundary, owner-produced join/text-entrance and caller middle/overlay windows are
deduplicated while retaining every origin. Query bounds round outward only for
inspection; exact fractional cut points and occurrence receipts remain intact.
Window, event-page, event-row and JSON-byte budgets bound the aggregate request;
skipped windows and opaque continuations remain explicit.

Document changes and canonical cut changes are separate facts. Semantic cut
comparison excludes occurrence IDs but keeps exact mapping and track evidence.
A missing page, unfinished cut coverage or different selected extent makes the
comparison partial. Identical cuts never establish identical picture or sound.
No public whole-revision duration/diff owner is invented, no screenshot index is
prepared, and processing entrances without canonical timing evidence remain
unobserved unless callers select windows. No ASR preparation or failed-work retry
occurs. Sound remains `not_listened`.

## Focused proof

The retained [public fixture bundle](../assets/09-review/README.md) exercises
actual request admission and socket service reads with explicit controlled silence
edits. A continuous split changes the authored document without adding owner cuts;
a later moved occurrence adds cuts at the old exit and new entrance. Revision
history before/after review is identical. Missing native audio and transcript
preparation remain honest; no native build, user media, model download or playback
is needed for this proof.

Portable helper tests cover moving-head pinning, fractional context, distinct
mapping changes, occurrence provenance, unfinished page continuation and total
window exhaustion. The fractional endpoint regression was deliberately falsified
by replacing ceil with floor, failed by one microsecond, then restored green.
The fixture initially returned pending event jobs; preparing only those explicit
fixture ranges demonstrated why a first bundle must remain partial rather than
claim unchanged cuts. Strict fixture typecheck, focused formatting/lint and
whitespace checks accompany these tests. Whole-system/native verification belongs
to the final parity slice.

Fresh visual reviews found two defects in the shared sheet: long IDs could cause
an event label to cross its own marker, and a zero-frame panel had no explicit
selection state. Both were reproduced red before fixing the common renderer.
Display-only ID abbreviations and explicit SVG glyph extents retain kind/time,
fit inside the plot and avoid the marker at narrow and standard widths; exact
manifest IDs are unchanged. An additive picture request count distinguishes
unselected evidence from actual pending/failed cards. Retained rejected images,
new captures and bounded pixel-difference evidence record these corrections.


## Acceptance and limits

The third unprimed visual critique accepted the current sparse sheet: no label
collisions/clipping, clear unselected/queued/processing states, readable exact event
timestamps. Its scope is two separated events at 1200 pixels/DPR 1. Crowded event
rows, smaller real captures, continuous picture and listened sound remain
unverified; the large axis/event separation is a nonblocking limitation because
local labels retain event times. A capture-only defect was corrected: the control
SVG is 493 pixels high and candidate 553, exactly 60 pixels taller for its two
extra event rows. The same dark page background now fills the control's unused
viewport margin. Its natural SVG region is pixel-identical; the original full
capture is retained, without stretching or hiding a subject region.

The independent Codex review found no actionable functional bugs after inspecting
receipts and running all eleven focused portable tests; it also checked helper
help and invalid-request behavior. No full/native or audiovisual quality check
was claimed. Shape/diff/docs review retains one renderer and one canonical event
owner, with no new service operation, timing mapper, table, package version or
compatibility wrapper. The helper orchestration and additive picture-request fact
are consumer-side only.
