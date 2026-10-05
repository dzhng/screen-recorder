# 22 — Local speech evidence feasibility

Status: not started. Question: **Which local providers earn speaker, acoustic-event and boundary claims?**

Dependencies: existing contracts only.

## Contract and owner

Existing local models/preparation/runtime plus labeled research evidence.

Evaluate diarization, acoustic events and boundary alignment as three independent bounded experiments. Freeze candidates/licenses, held-out labels, quality/abstention metrics and memory/runtime budgets before evaluation. Synthetic data tests mechanics only. No hosted substitution. Provider choice is outcome, not implementer preference.

## Focused proof and review

Model-specific quality/cost/coverage report per evidence family.

Real overlap, unknown speaker, short reaction/laugh/applause, silence and word edges. Separate speaker attribution error, event precision/recall and boundary error. Pin labels/models/runtime and disclose unsupported categories. A failed family remains unfinished or resliced, never quietly dropped.

## Independent family verdicts

- [ ] Diarization: labeled quality/cost gate and selected provider or explicitly unfinished.
- [ ] Acoustic events: separate labeled gate, accepted categories and provider or explicitly unfinished.
- [ ] Boundary alignment: separate error/coverage gate and provider or explicitly unfinished.

A pass for one family cannot close another. Before slice 23 pickup, materialize one implementation sub-slice per passed family, with its frozen provider/metrics and source-projection contract. Record failed families as unfinished scope.

## Boundaries and decision budget

Inherit the [global contract](../README.md#contracts-and-ownership) and narrow verification policy. Write-tests red/green precedes behavior changes. Existing native output and persisted identity remain unchanged unless this slice names the extension.

Delegate internal naming/decomposition, bounded fixture selection and reversible artifact styling. The recipe/provider/build decision is a measured research deliverable; freeze it and its limits in this file before any dependent implementation. Record actual commands, immutable input/runtime identities, coverage, failures and verdict. User feedback changes requested meaning, supported scope or visible appearance; mechanical preferences alone do not justify expanding the slice. A failed proof remains unfinished and must be narrowed or resliced, not waived.
