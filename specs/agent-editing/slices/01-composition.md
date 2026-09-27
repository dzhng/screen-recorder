# 01 — Composition identity and time

Status: implemented in an isolated composition pass, 2026-09-27; focused checks pass, independent integration review pending. Dependencies: [00](./00-corpus.md).

The [pure package](../../../packages/composition/README.md) now owns strict
authoring/asset schemas, immutable validation snapshots, exact nested placements,
source availability and occurrence queries. Its 16 tests passed, including rational
round-trip checks across 323 duration pairs, half-open boundaries, repeated/reordered
sources, held/still content, unequal linked AV, gaps, cycles and overflow. Removing
reverse-result ordering made its regression test fail with the wrong occurrence
order; restoring it passed. The repeat-reorder corpus CLI probe passed against
the hand-authored membership oracle. Package build, type checks, lint and formatting
passed. No native execution, production adoption or persistence is claimed here.

Verification: `bun run --cwd packages/composition build`,
`bun run --cwd packages/composition check-types`,
`bun run --cwd packages/composition test`, and the probe below. The package README
records exact rational outputs, inverse microsecond-bin/held interval semantics,
source metadata and error contracts. Root integration owns the workspace lock
update and independent review before marking this slice complete.

## Contract

One pure model represents independently placeable stream occurrences, synchronization groups, content/project anchors and exact time relationships.

## Seam and ownership

Create `@screenrec/composition` as a Bun workspace package. Export strict document types, `validateComposition`, `resolvePlacement`, `projectToSource` and `sourceToProject`; adopt the identity/time rules in contracts.md. No I/O or native calls.

## Work and review surface

Implement range/hold sources, empty compositions, non-overlapping tracks, acyclic source-content/project/normalized-clip anchors, inferred rational rates and all-occurrence reverse lookup. Include linked AV with unequal offsets/durations, repeated media, disjoint content-anchor fragments, attachments following held/still clips and source acquisition gaps. Only deterministic time/identity structure lands here; no rendering or edit persistence.

Create this planned probe in this slice:

```sh
node packages/test-harness/editing/composition.mjs --fixture repeat-reorder
```

## Acceptance

Table/property checks cover half-open joins, rates such as 2/3, safe-integer overflow, empty projects, held video, rejected audio holds, two occurrences of one source, anchor cycles and mapping round-trips within the declared rounding tolerance. Query fixture prints every occurrence and mapped time.

Keep the relevant [preservation gates](../verification.md#preservation-matrix) green. The [contracts](../contracts.md) and [single-owner rules](../architecture.md) are binding. Record evidence and remaining limitations in this Status line and the [README handoff](../README.md) before ending the pass.

## Failure boundary and discretion

If one representation cannot express the accepted insert/overlap/independent replacement cases without special paths, revise it here before consumers land. Do not relax old span validation as a substitute.

Delegated: Internal module split, data-structure choice and efficient exact arithmetic. Public time/anchor semantics are fixed by contracts.md.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.
