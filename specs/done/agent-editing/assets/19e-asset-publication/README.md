# Shared staged asset publication

Imported files, generated prepared audio and portable assets now share the same
immutable-byte staging and transactional publication owner in
[AssetStore](../../../../../packages/core/src/assets.ts). Local generated media is
probed from the copied bytes; it does not fabricate portable-package metadata.
The existing job attempt fence decides whether those bytes become visible.

Ordinary imports can reuse an already published filename when concurrent imports
of identical bytes use different extensions. Staged job/package receipts remain
bound to the file they inspected and refuse a changed publication path. One shared
publisher preserves both contracts; there is no new queue, catalog or asset kind.
Actual immutable byte/metadata collisions report `ASSET_CONFLICT`; malformed
package metadata still reports `INVALID_PACKAGE` at package admission.

## Verification

All 53 focused asset, portable-asset, prepared-audio and project-audio tests pass
with the frozen native worker supplied. The new transaction test was observed red
before staging existed. Independent review identified a concurrent import
regression across extensions; its added case reproduced the failure before the
fix. Both same-extension and different-extension cases now pass. A second
review reproduced a large-file race: staging-link removal changed ctime during
another attempt’s hash verification. The owner now serializes link, verification
and cleanup for the same asset only, then releases that transient state. The
32 MiB regression was observed red and now compares every byte successfully.
Strict descriptor/hash checks are unchanged. A first assertion used a generic
object matcher on that buffer and exhausted the test runner heap; the corrected
assertion uses complete Buffer.equals, without increasing the heap or timeout.

The public CLI/MCP prepared-audio journey passes exact original/gain PCM,
historical restart, cancellation, explicit retry and unchanged project state.
The prepared-package journey also passes current/historical and learned audio
transfer, receiver processing refusal, donor deletion, changed-recipe refusal,
undo and missing/corrupt PCM controls. These are existing complete journeys,
not new reduced fixtures. No audible playback or model inference was performed.

Two initial public attempts failed on `/tmp` as a symlinked path component.
The retained diagnostic stack identifies `IdentifiedFiles.open` rejecting that
path. The harness now resolves its scratch home with `realpath`, as the other
package journey already does. No production file check was loosened.

[Evidence](evidence.tar.xz) retains successful reports/media and failed reports;
[member hashes](artifact-files.json) authenticate the archive contents. This
prerequisite does not implement public excerpt selection, conversion, typed
extraction origins or public voice generation.

The final independent review found no actionable regressions; its41 focused
asset/preparation tests and core typecheck pass. Root also ran the wider53-test
set with native execution and repeated both full public journeys after the
concurrency fix. Final reports/media are stored under `public-final` and
`package-final` in the same archive.
