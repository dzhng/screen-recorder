# Package assembly verification

The generated package consumer exported a complete no-narration ZIP through the
shared intent owner. The relocation proof removes the original library, moves the
produced ZIP and uses actual CLI/MCP package frame reads against independently
prepared source expectations. Generated input includes nonempty cursor, geometry,
pause and scene evidence, revision cuts/history and acquired system audio.

- [Owner lifecycle](owner-tests.txt): 57 cases, including source/scene/index retention,
  canceled retry, failed prerequisite, actual service deaths at five assembly gaps,
  surviving native ZIP writer versus recording deletion, private cleanup/storage,
  locator substitution and source mutation.
- [Native neighbors](native-tests.txt): 31 archive/publication/workspace cases.
- [Produced ZIP relocation](relocation-test.txt): actual public retained/frame reader.
- [Normalized byte negative control](normalized-red.txt): a changed normalized
  generation incorrectly committed without its pinned byte comparison.
  [Restored check](normalized-green.txt) rejects it before publication.

Core verification passed 324 tests and workspace type checks passed. Lint reports
only two pre-existing unsafe-finally warnings in package-workspace-recovery.mjs.
Independent Codex review found the production dispatcher still used the old export
artifact name. Both service routing checks now consume export-recording, matching
the owner; no other findings were reported. Shape/diff/docs review keeps one export
lifecycle and a byte-only assembly module, with no parallel scheduler or public
preparation surface.

At this internal checkpoint, public creation still required service composition.
The [subsequent public integration](public.md) supplies that bundle and verifies
bundled startup. The standalone bundled-startup case was excluded only in this
source worktree, which had no built app bundle.
Acquired narration remains unsupported until accepted transcript data exists.
Process-kill recovery is tested; these receipts do not establish power-loss safety.
