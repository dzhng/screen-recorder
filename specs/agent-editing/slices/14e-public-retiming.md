# 14e — Deliver linked and independent retiming publicly

Status: implementation in progress; native policy/admission and async core/service owners are separate concurrent passes. Dependencies:14b,14c and14d. Parent14 owns final acceptance.

## Contract and seam

Bind verified retime recipe/policy identity through native capability discovery,
ProjectRenderSupport and existing execution requirements. Validate complete run
formats/counts before admission, including state prerequisites. Existing worker
deadlines must charge distinct full-run input/output preparation even for a short
query; worker process termination and draining retain cancellation ownership.

Use existing CLI/MCP editing, jobs, preparation, inspection, preview, export and
package operations. No new derivative registry or public recipe override. Cache
identity includes the verified policy/recipe; retained output remains readable
with the renderer unavailable.

## Admission ownership

Native metadata validation resolves physical source segments before checking
recipe admission. Compiler context counts alone can hide a shorter physical piece.
Reuse the exact C recipe owner and the existing converter format/debt owner; do
not copy a minimum-duration formula into TypeScript. The private validation
operation reads metadata but no PCM, and ordinary execution checks the same bound
recipe identity. Retained bytes remain readable without a current implementation.

Core requests pin/compile before awaiting native validation and submit only after
validation, with owner/deletion checks repeated at transaction entry. Existing
ready or already-admitted identities and retained reads do not repeat preflight.

Keep JobQueue's waiting admission callback synchronous: its current scan suppresses
queue pumping while admitting, so awaiting native work there would stall all lanes.
Preview.prepare returns a pinned snapshot and synchronous submit closure. For a
new video export, forward its idempotent intent-persistence callback through the
existing JobQueue admitted callback; preview admission and export intent then
commit or roll back together. Catalog has no nested transaction support. Do not
wrap queue submission in an outer transaction or add an admission flag/cache.

Existing export replay/retry uses its stored snapshot. The synchronous waiting
pump resumes only an existing exact preview job; a missing row requires explicit
async re-admission or an honest not-ready result. Ordinary audio/preview cache
identity must carry the retime recipe, since their range/settings identity alone
does not contain the full execution requirements.

## Verification and review surface

The parent14 retiming journey exercises actual CLI/MCP and native delivery. Verify
linked video/audio event timing and attachments, explicit unlink and independent
replacement, source evidence mapping, repeated/split/rate-change cases, exact
counts, prepared reuse/invalidation, cancellation and retained package playback.
Prove post-retime processing and source/raw evidence preservation together.

Judge only retimed event synchronization in frame-counter/landmark shots around
boundaries. Compare against the original fixture with compare-screenshots, then
run fresh screenshot-critique last. Open the shots with preview-shots for an
optional five-minute review while continuing independent work; absent feedback,
make the reversible visual decision from evidence and close the shots. Silence
never supplies missing audio or physical acceptance. Preserve prior exact-file
listening and verify production parity before requesting any new audition.

Delegated: capability wiring and budgeting within the existing workers/jobs.
Pitch defaults, timing, attachment scope and source semantics are fixed.

Keep the existing preservation gates, exact source-selection contract and frozen
workers intact. Build only in isolated scratch paths. Update this Status and the
parent14 pickup with evidence before committing. Run the repository review and
audit-choices passes. Missing perceptual evidence stays explicit; accepted mono
listening must not be repeated as a substitute for a different policy.
