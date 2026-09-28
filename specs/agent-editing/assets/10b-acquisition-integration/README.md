# Capture adoption and project context integration

An explicitly adopted capture owns its journal, indexed original-clock evidence
and immutable media independently of the donor. Acquisition metadata and import
execution have separate responsibilities within the same module: project readers
need the immutable binding, while the shared job queue runs copying, native
normalization and publication. One resource-reference ledger retains assets and
acquisitions; project history retains both in its revision transaction.

Capture audio support is normalized by the admitted asset origin, while raw
journal records retain their original clock and roles. Video support is explicitly
physical because the journal does not record video acquisition intervals. Matching
byte-identical capture roles share a binding only when their acquired support
agrees; conflicting histories refuse before context publication.

## Verification boundary

The [core adoption checks](adoption-tests.txt) exercise donor deletion, raw journal
hashes, normalized offsets/support, same-byte contexts, replacement omission,
undo/replay/reopening, source mutation, cancellation cleanup/retry, empty acquired
audio and ambiguous streams. Native parsing/probing is substituted only in these
core fixtures; [actual native adoption](../10b-source-acquisition/README.md) passes
through CLI/MCP. All [18 module hashes and the native binary](runtime-parity.json)
match the main worktree, so the retained isolated journey tested the integrated
runtime exactly.
Removing failed-attempt reference cleanup makes its [regression fail](release-mutation.txt).
The [shared evidence pass](../10b-evidence-owners/README.md) preserves the existing
recording/package domain while adding real acquisition ownership.

[405 core tests](core-tests.txt) passed before the final catalog refusal change.
The subsequent [format-6 broad run](core-under-load.txt) hit seven existing timing
deadlines; a [focused rerun](deadline-rerun.txt) passed 82/85 with three deadlines
remaining and a cancellation rejection during timeout teardown. These are retained
failures, not a blanket final-suite pass. The [isolated project checks](projects-isolated.txt)
then passed without changing limits. The remaining [portable](portable-isolated.txt)
and [storage](storage-isolated.txt) suites also passed individually (5 and 13 tests).
This is a set of controlled reruns, not one green final broad invocation. High concurrent browser-rendering CPU use in
another project was observed; this is context, not proof that every timeout is
explained. Existing scale/deadline acceptance remains open under slice 24.

The complete actual CLI/MCP [preview/export preservation journey](preview-export.json)
passes after the replacement fix. All [19 image hashes](visual-identity.json) match
previously reviewed output exactly; no new visual acceptance is inferred from a
status response. An initial invocation omitted the required native executable
setting and failed setup; the retained rendered journey explicitly supplied the
combined main-worktree worker.

## Findings and fixes

Independent code review caught the incompatible reference-table replacement.
Catalog format 6 refuses both earlier recording-keyed formats and the intermediate
format-5 evidence layout; it never migrates or resets them. The expanded existing
catalog regression [failed before the bump](format-refusal-red.txt) and passed
afterward while asserting the refused database bytes remain unchanged.

The [live preservation failure](preview-replacement-failure.json) caught a committed
replacement whose response contained an explicit undefined acquisition ID. The
protocol correctly rejected that non-JSON result. Replacement now removes the
omitted property, preserving physical-only meaning and JSON-safe replay receipts.
A [strict JSON round-trip regression](replacement-json-red.txt) fails on the old
shape; ordinary deep equality had ignored the extra undefined property, so it was
insufficient. The new acquisition journey independently reproduced this failure.

The second independent code-only review inspected changed/untracked files and
callers and found no actionable defect. Core/service type checks, composition/core/
protocol/service/CLI builds and focused formatting pass. Focused lint has one
pre-existing unused destructuring warning and no errors. The deterministic
[copy mutation preservation test](../10b-import-mutation/README.md) keeps real file
I/O while removing the earlier filesystem notification race.

Public asset transcript reads, occurrence queries and the full same-byte context
A-hole/B-full speech journey remain open. Nothing here establishes improved word
timing, natural speech joins, noise reduction or listening acceptance.

The [revised product skill's fresh-agent check](../10b-acquisition-skill/README.md)
completed capture adoption, synchronized placement, pinned preview and committed
export. Root verified its saved raw receipts and matching external bytes after
the agent's final response was interrupted. Audio listening remains unverified.
