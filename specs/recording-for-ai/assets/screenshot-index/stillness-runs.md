# Bounded sampled stillness

Ordinary coverage can reuse an image when the observed screen stays within one
bounded RGB envelope and the cursor evidence also permits reuse. The envelope
belongs to canonical source analysis, independent of edits or coverage windows.
[Scene analysis](../../../../packages/core/src/scenes.ts) owns the rule; the
[selector](../../../../packages/core/src/selection.ts) consumes its run identity.

Each channel's minimum and maximum span at most two eight-bit levels throughout
a run. Crossing that limit starts a new run. An oscillating rounding error can
therefore remain still indefinitely, while monotonic drift accumulates until it
exceeds the envelope. Averages would dilute a small feature; adjacent comparisons
alone would forget gradual drift. Neither represents this contract.

**Sampled equality is approximate:** genuine changes confined to this envelope can
collapse, including a subtle whole-page change. It is neither lossless equality
nor semantic equivalence. Features lost to the existing low-resolution raster or
sampling cadence remain outside its evidence. A run transition prevents ordinary
static collapse; it does not itself guarantee capture of every transient frame.

The source scan retains only two channel arrays and the two overlapping boundary
observations between chunks. Held source frames do not change the run. Source
coverage stores the run's actual start time, not RGB; restart creates a fresh
unpublished generation from the source beginning. The observation cache remains
disposable. Neither elapsed time nor source length expands working state.

Cuts reset selection state, and removed or out-of-span decoded frames supply no
run proof. Missing visual observations, missing run evidence and cursor uncertainty
remain conservative. Scene-boundary measurements and local frame/trail analysis
keep their existing semantics. Separate scene and selection policy identities
prevent reuse of certificates made under another equality contract.

## Verification evidence

The [native probe](stillness-runs.json) uses the unchanged generated stillness video
whose hash matches the original fixture. Native RGB observations pass through
canonical scene analysis and the core selector; the result retains only mandatory
endpoints with full sampled coverage. This is a core/native observation proof;
the [merged public lab](generated-review.md) now verifies retained delivery and all
seven generated scenarios. The full thirty-minute scale gate remains separate.

[Integration tests](../../../../packages/core/src/selection-evidence.test.ts) cover
rounding through multiple coverage and chunk windows, gradual drift, and a
three-level single-channel feature that changes and returns inside a window.
[Canonical analysis tests](../../../../packages/core/src/scenes.test.ts) preserve
both sides of a chunk overlap with held timestamps. Regression mutations that
forget accumulated extrema, widen the envelope, or assign the newer run to an
older overlapping observation each fail their corresponding assertion.

Core type checking, build, formatting and lint pass, along with all 211 core tests
and the three native scene-analysis tests. Independent Codex review found one
remaining native test import of the replaced source-analysis entry point; that
consumer was migrated and its native suite rerun successfully.
