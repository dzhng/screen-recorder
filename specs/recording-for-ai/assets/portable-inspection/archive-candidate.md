# Archive boundary research

This is preparation for 14c, not an accepted extraction implementation or a new
dependency. The moved-directory checks do not prove untrusted ZIP opening.

The Swift-native [ZIPFoundation project](https://github.com/weichsel/ZIPFoundation)
provides chunked extraction to a consumer closure, which could feed the existing
native descriptor-relative file ownership approach. Its
[reading implementation](https://github.com/weichsel/ZIPFoundation/blob/development/Sources/ZIPFoundation/Archive%2BReading.swift)
returns a CRC value; the caller must compare the expected checksum when using that
low-level API. This is a candidate for evaluation, not a reason to use its
pathname-based convenience extraction.

A concrete blocker to adopting its iteration API unchanged appears in
[Archive.swift](https://github.com/weichsel/ZIPFoundation/blob/development/Sources/ZIPFoundation/Archive.swift):
`makeIterator` ends with `nil` when a central-directory or local-header read fails.
Normal end and malformed-entry termination are therefore indistinguishable to a
plain public iteration loop. Matching all expected manifest entries before that
point does not establish that every remaining archive entry was examined. These
links describe the inspected development source, not a pinned release guarantee.

The next extraction feasibility test must include a valid manifest and all its
listed members followed by an unreadable extra archive entry. Reject it explicitly;
do not certify completeness merely because the manifest inventory was satisfied.
The parser must expose reliable end/error/count semantics or have another proven
way to establish complete bounded traversal. Evaluate this before selecting or
pinning an archive dependency. Avoid introducing a handwritten ZIP parser just to
patch a convenient library's missing signal.

Keep actual expansion limits, entry/path budgets, duplicate/case collisions,
symlink/special-file rejection, CRC plus inventory hashes, descriptor-owned staging
and cleanup in the same extraction gate. Package handles, context-scoped scheduling
and delivery revocation remain later ownership work.
