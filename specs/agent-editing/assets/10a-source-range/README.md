# Exact source-range evidence

This is deterministic composition-engine evidence, not a live transcript journey.
Source acquisition, generation pinning, phrase search, pagination, CLI/MCP delivery
and listening acceptance remain open in slice 10 and its downstream slices.

The [focused tests](../../../../packages/composition/src/source-projection.test.ts)
exercise exact retimed/repeated fragments, internal source and ancestor holes,
fractional split coverage, half-open joins, tied tracks, holds/silence, named lookup
and sparse interval selection. The [full suite](composition-tests.txt) passed all
104 tests, preserving existing point/bin, compiler partial-frame and sample-phase
coverage. Package build and typecheck, targeted oxlint and oxfmt also passed.

The [hole mutation](hole-mutation.txt) deliberately judged only the outside bounds:
the counterexample failed because an interrupted word became whole. The
[lookup mutation](lookup-mutation.txt) deliberately replaced the clip map with a
linear search: 100 named reads touched 100,100 collection entries instead of zero.
Both mutations were restored and the full suite passed afterward. The sparse-index
case reads fewer than 64 range keys among 4,096 intervals for one overlapping row.

The [independent review](review.txt) found no actionable correctness issue and
independently reran the suite and typecheck. Local shape review retained one shared
interval-index owner and one source/project clock owner; it removed a cast-based
source-index representation before review. No native processes or user libraries
were involved. Initial test attempts could not resolve the worktree's Zod dependency;
setup was corrected before behavioral evidence was gathered.

## Decisions for integration

- **Sound, high confidence: absent retained source coverage returns no occurrence.**
  If a query lies wholly in a removed interval, a known clip returns `null`, and
  all-occurrence lookup omits it. A partially retained word still returns its
  surviving fragments. The plan required retained occurrences but did not choose
  an empty-result shape. This keeps unavailable material from looking like retained
  speech; callers needing unavailability explanations must use source metadata.
- **Sound, high confidence: completeness belongs to each occurrence.** Splitting
  through a word yields two partial occurrence rows with exact complementary
  coverage. The projection does not fuse their clip identities into a whole word.
  Slice 10's phrase rules decide what can be searched across clip boundaries.
  Query windows are intentionally absent from this primitive, so paging cannot
  change editorial completeness.
- Lookup representation, module placement and exported names were explicitly
  delegated. A map owns named lookup; source-stream interval indexes and the render
  compiler share one selection primitive. All-occurrence lookup returns all
  matching occurrences and is not itself a bounded public pagination API.


## Main-worktree integration

The [integrated suite](integrated-composition-tests.txt) passes all 104 tests, and
composition/core/service builds and type checks pass. The complete [actual public
preview/export journey](integrated-public-journey.json) also passes after extracting
the shared compiler interval index, including processing, replacement, publication
faults, abandonment and deletion. All nineteen rendered images remain
[byte-identical](integrated-visual-identity.json) to the independently reviewed
preview evidence. This is preservation of that judged output, not new transcript
or listening acceptance.
