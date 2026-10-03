# Bounded transcript window seeks

Transcript admission guarantees nonoverlapping words. The shared reader can therefore seek the one word before a window and then read forward from the window boundary. A long word elsewhere in the recording no longer widens every subsequent lookup. Metadata retains its existing longest-word field; neither the package format nor public cursor shape changes.

Portable admission now enforces the same invariant across page boundaries before a package handle is available. This is necessary for predecessor seeking to be valid for both SQLite and portable records. [The shared reader](../../../../../packages/core/src/transcript-read.ts) owns the seek; [portable admission](https://github.com/dzhng/screen-recorder/blob/cab28df591efffc4ec32bdc7569b02ccf7dda388/packages/core/src/transcript-pages.ts) owns validation of externally supplied rows.

The adversarial source fixture ingests a long initial word and more than ten thousand subsequent short words through the real TranscriptStore. Before correction, a late window examined 10,002 word rows. The corrected test permits at most two and still verifies the exact returned word/range, a window inside the long word, and continuation from a clipped predecessor into the following word.

Portable tests modify actual page files, update descriptor hashes/counts/bounds, and update the edited projection to match. Removing nonoverlap admission causes both within-page and cross-page malformed packages to be accepted; restoring it rejects them. This is distinct from a hash-mismatch test. The mutation log preserves the erroneous resolved FileTranscript result.

Independent Codex review found no actionable regression and ran transcript preservation tests. After that review, the portable test was strengthened to keep edited output consistent; production code did not change. Final checks cover source reads, portable pages, transcript ingestion/ownership and processing. No native inference, live CLI/MCP or whole-spec acceptance is claimed by this focused pass.

Root integration at 74cc76e rebuilt core and passed all 29 source-reader, portable-page,
transcript and ownership tests in four files. This is separate from the delegate's
34-test gate, which additionally covered asset preparation.
