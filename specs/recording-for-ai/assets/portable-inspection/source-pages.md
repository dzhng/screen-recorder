# Source evidence after relocation

[Generated receipt](source-pages.json) records a source-only export made through
SourceEvidenceStore, followed by deletion of its original catalog and normalized
file and movement of the directory. The file reader reproduces timestamp/sequence
cursor pages, uncertain geometry, pause boundaries and clipped acquisition ranges.
The same production trail/audio planners consume it without library rows.

The [focused test](../../../../packages/core/src/evidence-pages.test.ts) crosses
page edges, checks invalid continuations and identities, and tests changed/missing/
truncated members, unsupported metadata, leaf symlinks and read budgets. Deleting a
distant page leaves an unrelated local lookup usable; looking up the missing range
fails. Replacing the portable pause query with an empty result fails the parity test.

Independent review identified two SQLite seek regressions in the extracted storage
adapter: an unplaced-geometry lookup could scan cursor history, and expression-tuple
epoch bounds did not constrain the epoch index. Both are corrected. The regression
now inspects actual executed production query plans; removing either correction
reproduces its corresponding failed seek assertion.

The sampler boundary is generated in memory and the audio path is only planned.
This is not native decoded parity, a complete package, an authenticated manifest,
or an untrusted-archive containment result. [14b2](../../slices/14b2-source-evidence-pages.md)
owns those scope boundaries and the next scene/index transport step.

Run the core build before the full core suite (its existing concurrency fixture
executes built modules). The source-page fixture can emit a new receipt through
`SCREENREC_SOURCE_PAGES_EVIDENCE` while running its focused test file.

The [merged bundle receipt](merged-integration.json) records a rebuilt app at the
listed revision and eleven passing generated public audio/trail integration checks.
These exercise CLI/MCP delivery, pinned cuts, acquisition gaps, geometry uncertainty
and explicit retry through the live reader and native worker. They complement the
source-only relocation proof; they do not establish native package relocation.
