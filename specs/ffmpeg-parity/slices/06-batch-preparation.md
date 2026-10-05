# 06 — Bounded selected-file preparation

Status: implemented; focused helper proof passed. Question: **Can selected takes prepare without duplicated or unrelated work?**

Dependencies: existing import/job contracts and slice 07's non-preparing transcript status read for interrupted ASR admission recovery.

## Contract and owner

Consumer helper over current import/model/job contracts; no new queue or catalog.

Explicit file list, requested preparations and concurrency cap produce per-item IDs/readiness/errors and resumable request identities. Reads never download models. Preserve independent source clocks; keep successful work when one item fails.

The [consumer helper](../../../skills/screenrec/scripts/batch-prepare.mjs) owns its
manifest and executable help. Invoke it with the bundled Node interpreter or an
agent's existing compatible Node; it requires no separately installed media tools.
Import identities and uncertain dispatches are saved before calls. Pending or
uncertain work retains an admission slot; a polling budget cannot become permission
to queue another source. Imported facts are reused, and only named stream IDs
request transcripts. Recover uncertain transcript admission with `prepare:false`;
failed work restarts only through explicit `--retry-failed`. Shared
[CLI invocation](../../../skills/screenrec/scripts/screenrec-cli.mjs) owns process
deadlines, byte limits and envelope decoding for consumer scripts.

## Focused proof and review

Two-source inventory and interrupted-resume manifest.

Use one success, one failure and resumed run; prove concurrency/work budgets and reuse of completed results. No recursive unrelated scan, unconditional ASR, upload or extra media copies.

`node --test scripts/batch-prepare.test.mjs scripts/consumer-cli.test.mjs` proves
selected-only calls, retained success/failure, bounded outstanding work, exact
import replay after CLI/service transport errors, model absence without implicit
ASR retry, and read-only reconciliation of interrupted transcript admission. A
standalone helper invocation saves its manifest before submission, resumes without
another import and preserves source bytes. Tests use isolated scripted public CLI
responses; they do not claim native media execution or speech quality. Slice 07
separately verifies that `prepare:false` reaches actual source/project owners.
All helper request shapes also pass the current production operation schema,
bundled from this checkout's sources with the existing shared dependency bytes.

Red/green evidence: missing modules first failed; absent-model resume repeated ASR
until the retained failure rule; inherited output pipes extended a deadline until
local pipe retirement; symlink invocation produced no output until native Node main
discovery; interrupted transcript admission lacked recoverable status until intent
checkpointing/non-preparing reconciliation. Independent Codex reviews found and
resolved the CLI deadline/pipe and transport/ASR uncertainty seams. A final
multi-stream review found that failed siblings must wait for pending
stream jobs to drain; its red/green regression now preserves the admission cap.
Lint, formatting and whitespace checks cover the changed files. No user library
or recording was read or modified, and no native build ran.

## Boundaries and decision budget

Inherit the [global contract](../README.md#contracts-and-ownership) and narrow verification policy. Write-tests red/green precedes behavior changes. Existing native output and persisted identity remain unchanged unless this slice names the extension.

Delegate internal naming/decomposition, bounded fixture selection and reversible artifact styling. Public meaning and backend policy are fixed above; resolve a new semantic choice in this spec before coding it. Record actual commands, immutable input/runtime identities, coverage, failures and verdict. User feedback changes requested meaning, supported scope or visible appearance; mechanical preferences alone do not justify expanding the slice. A failed proof remains unfinished and must be narrowed or resliced, not waived.
