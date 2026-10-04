# Pinned preview cache publication

The [preview owner](https://github.com/dzhng/screen-recorder/blob/867080a2b22c845780cbfde4bb926c288bb4707a/packages/core/src/preview.ts) combines existing
revision, source-evidence, job and cache authorities. It neither renders media nor
interprets edits again. The service's render attempt completes its exclusive copy
before the cache/queue can publish a result. The movie receipt has one shared type.

The [native report](native.json) and [terminal log](native-tests.txt) exercise the
real source-normalization worker, core preview owner and movie assembly. A cut
remains four seconds while a concurrent undo moves the current revision to six;
both decode to their expected source-frame sequences and generated audio. The cached
cut still decodes after the native attempt directory is gone. Actual library video
and audio copies, plus the independent lifetime probe inputs, remain byte-identical.

Core tests cover pinned regeneration after eviction, explicit transient-failure
retry, non-retryable inconsistent receipts, cancellation with a partial output,
source dependency admission, and reopened catalog/cache reads. Reconciliation
removes an interrupted reservation while retaining the finished movie. Replacing
the pinned revision lookup with current revision makes the eviction regression fail
at six seconds versus four; restoring the implementation returns it to green.

Independent review found the native lab was checking only the original fixture
files after moving preview input into the library layout. The assertions now cover
the actual library copies too. No other actionable runtime defect was reported.
The first native rerun encountered FFmpeg's overwrite prompt when decoding the same
cached file twice; owned scratch decoding now explicitly disables stdin and permits
replacement of its generated RGB output. That failed process was reaped before rerun.

All [283 core tests](core-tests.txt), core/service type checks, six service render
tests and focused lint pass. The default concurrent core run hit an existing
portable-index test’s five-second deadline during native workload overlap; the
full rerun used four test workers, with no timeout or assertion changes.

## Remaining boundary

This is an internal production-consumer checkpoint, not a public preview feature.
The current native lab has no cursor observations; accepted pointer composition
must precede protocol/menu exposure. Reopened cache evidence does not establish
safe cleanup of native staging after abrupt service death. That ownership proof,
public delivery leases, app playback and real speech audition remain in
[13e](https://github.com/dzhng/screen-recorder/blob/2e1028cddc3f89d58018a4ebcbc8895b28a78ae1/specs/recording-for-ai/slices/13e-preview-publication.md) and its parent.
