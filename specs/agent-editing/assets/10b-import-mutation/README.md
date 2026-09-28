# Deterministic import mutation preservation

The asset-copy regression mutates the real source file after the first actual
FileHandle read completes and before that completion reaches the importer.
The spy forwards the original receiver and arguments; reads, writes and final
stat calls remain real filesystem operations. A same-size overwrite prevents
file-length checks from accidentally satisfying the test. Explicitly changing the
real modification time removes filesystem timestamp granularity as a variable.
No watcher, sleep, importer stub or production copy change is involved.

The [countertest](guard-removed-red.txt) temporarily removed only the final
mtime/ctime comparisons. Import incorrectly succeeded and the required
SOURCE_CHANGED assertion failed. Production code was restored, then all
[73 combined core checks](combined-green.txt) and [typechecking](typecheck.txt)
passed. The test still requires no published asset, and restores the read spy
and closes the mutation handle in finally.

Independent Codex review found no actionable issue and ran all twelve asset
tests successfully. The final adjustment to the spy's argument annotation only
preserves Node's overloaded read arguments; runtime behavior is unchanged.
The tiny fixture tests the same publication boundary without relying on a large
copy taking long enough for an asynchronous filesystem watcher to fire.
