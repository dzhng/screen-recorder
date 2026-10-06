# Scoped closeout

Shape: replacement stays in existing export intent, native publication and asset
owners. No queue, janitor, migration, compatibility receipt reader or rollback
path is added. Two indexed lookups bind trusted publication and imported-source
identity. The private committed marker preserves proof when cleanup removes the
old leaf before the prepared receipt; unique-inode accounting avoids counting
its two hard links twice.

Diff: source identity is checked at admission and before commit; overwrite is
part of exact request replay identity. A superseded intent does not republish.
Native staging retains both the new payload and unknown displaced entries.
Deadline budgeting includes pinned victim bytes under the existing worker cap.
Focused red/green tests cover partial cleanup and conflict truthfulness.

Docs: public operation help and service/native owning READMEs explain receipt
trust and the cooperative locking boundary, with working root-to-owner links.
The feature's global status/traceability remains parent-owned.

Independent read-only Codex review completed with one P2 finding: retained
conflict symlinks made aggregate storage fail. Native metadata-only accounting
now includes the retained link's own length while still rejecting symlink
payloads; the link's referent is never followed. Native/public red-green proves
storage remains readable after the actual conflict and unchanged when that
external referent grows. Corrective scoped read-only rereview completed clean (exit zero, turn.completed,
nonempty final verdict); the first whole-change finding is resolved.
Both verdicts, completion receipts and the corrective scope are retained beside
this document. All 36 focused native/service/public CLI checks pass; six historical
export checks and two budgeting checks also pass. Scoped type, lint, format and
root-to-owner link checks pass. Final verdict across shape, diff and docs: clean.
The parent owns feature integration and the final full-system gate. No visual review is needed for this
wire/filesystem change; no rendered appearance or media quality claim is made.
