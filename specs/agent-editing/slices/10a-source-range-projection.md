# 10a — Exact source-range occurrences

Status: not started. Dependencies: [01](./01-composition.md), [05](./05-compiler.md).

## Contract

A source word or event range maps to every retained project occurrence with exact
source/project fragments and a whole/partial distinction. Repeating, trimming or
retiming a clip must not lose occurrences or turn a partial word into a whole one.
This pure prerequisite does not acquire transcripts or expose public inspection.

## Seam and ownership

The composition time mapper owns range projection beside its existing point
mapping. Reuse exact rational source/project clocks, resolved availability and
track ranks. The compiler and future evidence readers must share selection and
mapping primitives; core must not implement a second rate calculation.

Project one named range clip without scanning every clip for each source word.
A reusable validated-model lookup may serve repeated queries. All-occurrence
queries preserve stable project-start, track-rank and clip-ID ordering. The
existing point/bin API keeps its current semantics. Held pictures retain point
semantics; they cannot be mislabeled as retained whole speech ranges. Asset-free
silence supplies no source evidence.

## Work and review surface

Expose typed range results carrying occurrence identity, the original queried
source range, selected source/project fragments and explicit completeness. Clip
selection, source availability and ancestor support all constrain retained
fragments. No rounding to integer microseconds before reporting exact fragments.
Keep query-time clipping separate from editorial partiality so paging/windowing
cannot change whether the edited word was whole.

Use the existing composition test entry point as the runnable review surface:

```sh
bun run --cwd packages/composition test
```

## Acceptance

Compare exact expected fragments for repeated/reordered sources, rational rates,
partial selections, stream holes, ancestor holes, adjacent boundaries and tied
track times. Preserve point/bin mapping and the compiler's existing partial-frame
and sample-phase gates. A split of an unchanged mapping must retain equivalent
range coverage without accumulating rounded endpoints. A focused counterexample
must fail if partiality is computed from only the bounding interval while an
internal availability hole is present. Repeated per-clip reads must not scan all
other occurrences; document the bounded lookup seam.

This is deterministic engine evidence. Slice 10 must still exercise real source
acquisition, pinned generations, bounded project pagination/search and CLI/MCP
journeys. No transcript timing or listening-quality acceptance is inferred here.

## Failure boundary and discretion

If this pass requires transcription storage, job admission or public schema
changes, it has crossed its seam. Those remain slice 10. If the current compiler
index cannot be shared cleanly, extract its coherent selection owner instead of
introducing another editorial time mapper.

Delegated: internal module placement, lookup representation and exported type
names. Exactness, availability, partiality and ordering are fixed contracts.

Update the slice Status and README handoff with evidence before committing. User
feedback changing source/project or partial-word semantics changes this contract;
internal representation remains reversible implementation discretion.
