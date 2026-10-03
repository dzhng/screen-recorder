# Shared catalog owner

Commit `7585bc5` extracts the existing connection, format check, transaction and
CatalogError into one Catalog owner. RevisionStore extends it; consumers import
the error directly. No second database, compatibility re-export, schema change or
new transaction policy is introduced. This is a structural prerequisite for asset
and project owners to share a fresh library without creating recording tables.

Root core build and service type check pass. The first root library/jobs run passed
66 tests and timed out on the unchanged large-history test. Independent Codex review
then ran all 67 tests successfully and passed core type checking; no timeout was
raised. It found catalog initialization, transactions, error behavior and direct
imports preserved. The final review and root shape audit found no actionable issue.
