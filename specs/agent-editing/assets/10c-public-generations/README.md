# Public source-generation invalidation

An immutable project revision can outlive the source analysis recipe that supplied
its evidence. The old cursor must refuse a different source generation; a fresh
query must preserve the edit and its meaning. These journeys verify both branches
of the shared project dependency check through actual CLI and MCP operations.

## Faithful replacement trigger

Published source transcripts and scenes are retained canonical evidence, not
ordinary evictable derived-cache files. Their source preparation paths do not call
queue regeneration. Retrying a ready job intentionally leaves that job unchanged.
A changed decoder/model/policy or scene implementation recipe identifies new work
for the same source selection.

The test simulates that release boundary in one isolated child process. Each
[scene](../../../../packages/test-harness/editing/generation-scene-service.mjs) or
[transcript](../../../../packages/test-harness/editing/generation-transcript-service.mjs)
loader targets exactly one known built-module URL, asserts exactly one expected
literal, and substitutes only the source recipe identity. Product files, private
catalog rows and native responses are not patched. There is no force API, product
override or added production lifecycle. The stored-module and loader hashes are
recorded in [runtime agreement](runtime-agreement.json); this is not a claim that
two released binaries were executed.

## Verified public behavior

[Native scene results](scenes/generation.json) retain the original and replacement
job recipes, real source attempt identities, old-cursor errors and fresh pages.
The same frozen native worker actually samples the selected media again, and the
normal queue and scene store publish the replacement. No scene output is mocked.

[Frozen-ASR transcript results](transcripts/generation.json) exercise the distinct
transcript dependency branch and both public transcript paging and phrase search.
Only engine output remains frozen, through the existing worker fixture: real raw
transcript ingestion, job publication and consumers execute. The [baseline](transcripts/frozen-calls-baseline.json)
and [replacement](transcripts/frozen-calls.json) engine-boundary receipts retain
that distinction. This proves no fresh ASR accuracy or listening quality; native
inference retains its separate 10b evidence.

Both journeys establish:

- Ready-job retries return the unchanged job before and after replacement.
- The new recipe creates a new job and source attempt; the old job stays ready.
- Old project cursors return `ARTIFACT_CHANGED` through CLI and MCP both before
  and after replacement publication.
- Fresh limit-one reads follow every continuation and preserve the pinned revision.
  Full rows and phrase matches agree, allowing only explicitly checked replacement
  source generations. Revision-derived editorial cut rows remain exactly unchanged.

The [scene report](scenes/report.json) and [transcript report](transcripts/report.json)
include the complete existing public scenarios as preservation gates. The
[shared harness](../../../../packages/test-harness/editing/generation-evidence.mjs)
contains the assertions and normalization boundary; it never hides unknown generation
values. Scene generation IDs are compared separately before normalizing that one
field; transcript normalization accepts only the observed replacement-to-original
mapping.

## Acceptance boundary and review

[Negative controls](negative-controls.json) leave the recipe unchanged across the
restart. Both journeys then fail because the old cursor correctly remains valid;
restoring the recipe substitution passes. [Independent review](review.json) found
no actionable issues in the combined fixture. Review was read-only and did not run
native processes; the retained passing public journeys supply runtime evidence.
Changed-file syntax, lint, formatting and diff checks pass. No production source
or schemas changed in this acceptance pass.

Together with the [10c acceptance matrix](../10c-project-cuts/README.md#slice-10c-acceptance-audit),
these gates complete bounded occurrence/event/phrase acceptance. Public checkpoint
file loss and real-store core cache-owner eviction retain their separate labels;
this pass adds no LRU eviction claim. Umbrella 10, project screenshot-index work,
release-scale budgets and speech/media quality gates remain open.

[Integrated confirmation](integrated.json) reruns both complete public journeys on
the combined root runtime. All recorded runtime hashes match the files executed;
the acceptance boundaries above remain unchanged.
