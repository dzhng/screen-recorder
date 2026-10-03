# Shared source evidence ownership

This prerequisite gives acquisition contexts and recordings the same bounded
source-evidence parser, indexed readers, portable pages and reclamation path.
The owner is explicit and participates in every database and portable identity.
Authentic capture roles and raw source clocks remain unchanged. Recording-only
scene, index, transcript and presentation consumers retain their actual domain.
The acquisition importer supplies its own admission validator; it does not create
a recording. Catalog format 5 refuses previous unshipped layouts.

This does **not** complete 10b: public acquisition adoption, selected-stream
transcript wiring and the same-media/different-context journey remain separate
integration gates.

## Evidence

- [Full core suite](core-tests.txt): 399 tests passed, including the two new
  acquisition ownership/publication tests.
- [Service preservation](service-tests.txt): 18 deletion, operation and subprocess
  round-trip tests passed. Requested nonexistent package test filenames contributed
  no tests; this log's actual three executed files are the evidence boundary.
- [Final focused checks](final-focused.txt) and [type checks](types.txt) cover
  ownership plus index/portable readers after the final cleanup.
- [Publication mutation](publication-owner-mutation.txt): removing the final owner
  validation makes the retirement-during-ingestion test fail. Production restored.
- [Registry and initial relocation invocation](registry-and-initial-relocation.txt):
  registry 12 passed; relocation initially failed setup because the native
  executable was not supplied through its required seam.
- [Corrected native relocation](native-relocation.txt) and its
  [report](relocation-report.json): actual generated internal-directory relocation
  passed with original library removal, unchanged source hashes, equal pixels,
  PCM and retained context. This is not ZIP/public package or ASR acceptance.

Independent Codex review found omitted JavaScript evidence-store constructors in
service/macOS harnesses. The repository-wide caller sweep fixed those constructors
and source identities; a second scoped review found no actionable correctness
issues. Recording-specific scene/index/transcript identities were retained.
The first review's sandboxed broad test attempt hit localhost `EPERM` in speech
model fixtures and FSEvents `EMFILE` in the existing asset-mutation test. Those are
not counted as green; the retained full core run above was outside that sandbox.

Shape/diff/docs review found one shared owner appropriate: no alternate evidence
store, parser, queue or compatibility shape. The production change primarily
replaces recording-specific keys and explicitly checks real recording consumers;
new tests pin owner isolation, portable identity and publication lifetime.
