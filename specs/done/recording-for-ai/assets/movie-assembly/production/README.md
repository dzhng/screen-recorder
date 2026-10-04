# Production native assembly and attempt lifetime

`media.renderMovie` now uses the sole assembler in `ScreenRecorderWire`. The
optional native target contains lifetime tests only, using that production owner;
its copied renderer/operation implementation has been removed. There is no public
preview operation yet.

Nine real-worker movie checks pass, including the original generated timing,
nonzero tiny AAC/FFmpeg boundary, source-isolation and video pixel/color-tag
comparisons. The new 1,001-span/acquisition case emits 48,048 native decoded audio
frames over exactly 1,001,000 µs, while the public excerpt rejects the same plan
with `LIMIT_EXCEEDED`. See [report.json](report.json). The shared PCM owner advances
through ordered acquisition intervals with a monotonic cursor, avoiding a complete
interval-list scan for every retained span.

`movie-lifetime.mjs` drives the existing `mediaWorker` and `withRenderedMedia`:

- Abort after the final AAC assembly file appears; the child is already gone
  (`ESRCH`) while its partial file still exists, then the attempt owner removes it.
- Deadline and native input errors leave no attempt directory or consumer result.
- Successful consumption sees an AAC receipt and readable output; returning from
  the consumer ends that same attempt lifetime.
- Original generated video and audio remain byte-identical.

The native lifetime executable calls the actual production mux through Swift's
package-local access (so the test target does not require debug-only test imports). Two optional internal observation callbacks are not wire
parameters or environment flags. One runs **after invoking the SDK's asynchronous
`finishWriting`** and checks its status is still writing; it cancels the owning
Task at that point. The cancellation handler reaches the actor while finalization
is suspended, cancels the writer, and the Task returns cancellation. The other
throws a named failure after an actual compressed video sample append. The audio
pump sees that shared first failure and returns the original message within three
seconds, not a generic readiness timeout. This does not claim the fixture forced
the audio input to become unready; readiness checks also consult that same stored
failure while waiting.

The service's existing process deadline remains the final interruption authority.
It waits for actual child close before the shared render-attempt owner reclaims
files. Callback completion cannot undo any separate durable consumer publication;
that commit owner still must fence or reconcile its result. Restart reconciliation
remains with the future durable preview/export job owner.

Reproduce after building protocol/core/service and native `screenrec-native` plus
`ScreenRecorderMovieTests`:

- `node --test helpers/mac/Tests/movie-render.test.mjs`
- `node --test packages/test-harness/movie-lifetime.mjs`

Focused service render/worker tests (12) and existing audio-wire checks (6) also
pass. Full adjacent-speech audition, five-minute A/V drift/memory, pointer overlay,
and public app playback/preview remain parent gates; the sixty-second generated
lifetime input is an interruption fixture, not a long-run synchronization proof.

Independent Codex review and the integrating owner's review found no actionable
issues in this production pass. No broad native scale run was used as a substitute
for the focused lifetime checks.

[Combined main verification](merged-verification.json) pins the rebuilt app worker
and passes all ten movie/lifetime checks after integrating shared presentation
support. The first default-debug run found a stale executable; the successful run
explicitly selected the rebuilt bundled worker. No assertions were weakened.
