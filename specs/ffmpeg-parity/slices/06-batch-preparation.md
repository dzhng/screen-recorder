# 06 — Bounded selected-file preparation

Status: not started. Question: **Can selected takes prepare without duplicated or unrelated work?**

Dependencies: existing contracts only.

## Contract and owner

Consumer helper over current import/model/job contracts; no new queue or catalog.

Explicit file list, requested preparations and concurrency cap produce per-item IDs/readiness/errors and resumable request identities. Reads never download models. Preserve independent source clocks; keep successful work when one item fails.

## Focused proof and review

Two-source inventory and interrupted-resume manifest.

Use one success, one failure and resumed run; prove concurrency/work budgets and reuse of completed results. No recursive unrelated scan, unconditional ASR, upload or extra media copies.

## Boundaries and decision budget

Inherit the [global contract](../README.md#contracts-and-ownership) and narrow verification policy. Write-tests red/green precedes behavior changes. Existing native output and persisted identity remain unchanged unless this slice names the extension.

Delegate internal naming/decomposition, bounded fixture selection and reversible artifact styling. Public meaning and backend policy are fixed above; resolve a new semantic choice in this spec before coding it. Record actual commands, immutable input/runtime identities, coverage, failures and verdict. User feedback changes requested meaning, supported scope or visible appearance; mechanical preferences alone do not justify expanding the slice. A failed proof remains unfinished and must be narrowed or resliced, not waived.
