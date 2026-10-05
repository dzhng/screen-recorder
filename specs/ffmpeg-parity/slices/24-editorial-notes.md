# 24 — Portable task-side editorial notes

Status: complete. Question: **Can another session resume rationale without confusing annotations with current state?**

Dependencies: [09](09-review-bundle.md).

## Contract and owner

Versioned task-side manifest; existing revision/source/artifact IDs remain authoritative.

Store caller intent, selected/rejected candidates, rationale, unresolved issues and exact revision/occurrence/artifact references. Explicitly transfer beside project package. Stale revision is visible. No new catalog, mandatory package version or session diary.

## Focused proof and review

A transferred small notes manifest and resume check.

Pin chosen revision/artifacts; switch current revision and verify historical annotations do not mutate it. Missing artifacts remain missing. Resume settled choices without repeat preparation or edits. Promote to product storage only after a separate demonstrated transfer requirement.

## Boundaries and decision budget

Inherit the [global contract](../README.md#contracts-and-ownership) and narrow verification policy. Write-tests red/green precedes behavior changes. Existing native output and persisted identity remain unchanged unless this slice names the extension.

Delegate internal naming/decomposition, bounded fixture selection and reversible artifact styling. Public meaning and backend policy are fixed above; resolve a new semantic choice in this spec before coding it. Record actual commands, immutable input/runtime identities, coverage, failures and verdict. User feedback changes requested meaning, supported scope or visible appearance; mechanical preferences alone do not justify expanding the slice. A failed proof remains unfinished and must be narrowed or resliced, not waived.

## Selected consumer seam

A bounded JSON notes file is explicitly copied beside a project transfer, with
versioned task-side syntax independent of the product package version. Candidate
references retain public revision/source/occurrence identities or a task-local
artifact key whose entry retains its exact public receipt. The consumer resume
helper reads current project metadata and the pinned historical revision only;
local artifact checks report presence, not content/quality verification. Missing
files, missing identities and a changed head remain facts rather than triggers
for preparation, importing or editing. There is no save operation in the service,
automatic transfer, remapping of imported identities or product-storage adoption.
The caller writes and copies the task file explicitly.


## Focused proof

The consumer [helper](../../../skills/screenrec/scripts/task-notes.mjs) owns its
syntax and byte limits in executable help. Caller notes retain opaque extra
receipt fields; task-local keys never replace public artifact identity. Project/occurrence selections require pinned revision context; independently owned
source, acquisition, job and export receipts keep their own identity structure. Unsupported note
versions and unpinned occurrence references fail before metadata dispatch. The
shared bounded task-file reader now has a general name because both CLI-delivered
media inspection and explicitly transferred notes use the same file semantics;
no duplicate reader or compatibility alias was introduced.

The retained [socket fixture](../assets/24-notes/README.md) shows current then
historical notes, unchanged revision history and zero native calls. Portable proof
copies the same notes into a second directory and preserves exact decisions/hash;
a missing artifact remains missing until explicitly copied. Path traversal and
unavailable historical identities remain visible rather than triggering work.
File presence is explicitly `not_checked` for content/quality, and artifact keys
without transferred metadata remain unresolved. No source or artifact preparation,
failed-work retry, implicit import, identity remapping or edit happens on resume.

The version refusal was deliberately falsified by removing its guard, failed with
a missing rejection, then restored. A separate actual red exposed a local artifact
key bypassing occurrence pin validation; all identity fields now obey the same
validation before a local key is accepted. Focused public fixture typecheck and
formatting/lint accompany these tests; full/native checks remain at the parity end.

Independent owner review reproduced three valid-receipt refusals: acquisitions
own multiple bindings independently of an asset, physical evidence preserves null
absence markers, and export intent pins its revision in a nested snapshot. Each
case went red before correction. Admission now distinguishes independently owned
source/acquisition/job/export identities from project/occurrence selections rather
than reshaping receipts into a second identity model. Null fields remain null and
do not become anchors. Occurrences still require their project and revision;
public snapshots and extra fields stay verbatim.

The broadened task-file boundary also exposed a real bounded-work defect: opening
a FIFO blocked before the existing regular-file check. The CLI regression timed
out red without dispatching metadata. The shared reader now opens nonblocking,
then checks the descriptor is a regular file and within its byte budget; normal
file bytes remain unchanged. The POSIX CLI regression now refuses the FIFO
promptly. This is a shared read-boundary fix, not a polling loop or notes-specific
file reader.


## Acceptance and limits

Final independent Codex review found no actionable findings after tracing actual
protocol/core/export owner contracts. Its fifteen focused portable tests cover
raw null/export snapshots, occurrence pinning and regular-file FIFO refusal; it
explicitly did not run the public fixture or full/native suites. This agent's
thirty-six related portable tests, three actual public socket fixtures and strict
fixture closure typecheck pass, with focused lint/formatting/whitespace checks.
Earlier identity findings were fixed with observed red/green regressions rather
than dismissed. Shape/diff/docs review keeps one bounded reader, opaque public
receipts, task-local annotations and metadata-only resume; no product storage,
automatic transfer, package-version gate or compatibility bridge was introduced.
No audiovisual quality or recipient package adoption is established by this
slice; the joined product-transfer journey remains a final-parity responsibility.
