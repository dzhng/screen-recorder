# 03a — Preserve exact boundaries created by edits

Status: complete. [Evidence and review](../assets/03a-boundaries/review.md):
19 tests, build/type checks and corpus probe pass; rounding mutation fails. Dependencies: [01](./01-composition.md).

## Contract

Splitting or trimming a retimed clip preserves its affine source mapping. An edit
must not silently round a fractional boundary and change which frame or sample a
later query selects.

## Seam and ownership

Composition owns serializable exact time values for stored selection and placement
ranges. Command coordinates and admitted source metadata remain integer
microseconds. Whole stored times use numbers; fractional stored times use reduced
safe-integer numerator/denominator pairs. Existing exact arithmetic remains the
single evaluator. Fractions outside the serializable bounds fail explicitly.

## Work and review surface

Extend stored clip source ranges and project/content anchor ranges to accept exact
times. Preserve integer documents unchanged. Reverse queries intersect the source
microsecond bin with a fractional selected range before mapping it to project time;
a split may produce two fragments of one source bin. Never invent a duplicate speed
or original-mapping field to compensate for rounding.

Run the composition suite and the existing repeat/reorder CLI probe. The focused
regression compares one retimed clip with two exactly equivalent fragments and
checks every integer project point plus the inverse bin crossing the split.

## Acceptance

The exact split and original select identical source times. Deliberately rounding
the stored boundary must fail that test. Fractional project origins preserve
phase, half-open ends and inverse lookup; integer queries, holds, acquisition gaps,
cycles and safe-integer constraints retain their existing tests. Build and type
checks pass, and no renderer/storage capability is implied by this model change.

## Failure boundary and discretion

Do not preserve integer-only persisted endpoints at the cost of a shifted source
mapping. Do not silently round a fraction that cannot fit the persisted format.
Internal helpers are delegated; public command coordinates, exact semantics and
canonical integer/fraction representation are fixed by this slice. Update status,
[contracts](../contracts.md), the [README](../README.md) and choices with evidence.
