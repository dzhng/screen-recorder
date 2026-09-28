# Project audio tap evidence

Project WAV inspection and movie preview resolve immutable dependencies and
capabilities through one [project window owner](../../../../packages/core/src/project-window.ts).
The compiler selects audio contributors before constructing processing and execution
requirements. This matters for projects containing video: inspecting audio must not
require a picture renderer or retain picture bindings. Tap truncation and routing
remain composition-owned, so child taps exclude parent processing while parent dry
taps retain processed children.

[Core tests](../../../../packages/core/src/project-audio.test.ts) exercise the real
catalog, assets, project revisions, queue and disposable cache in isolated homes.
The fixture imports an actual stereo float WAV but supplies controlled probe metadata,
including a picture stream used to detect accidental picture dependencies. This is
core/native boundary evidence, **not public CLI/MCP or real video probing acceptance**.

The native case calls the existing `media.mixCompositionAudio` worker with compiler
instructions and compares every returned stereo sample against an independent gain
oracle. The frozen worker SHA-256 is
`611ee1097c95fa2eae4ef7c6a0cb11facc39d236c642b953e9ccf072f8f05137`.
No native rebuild, model preparation, capture, app, playback or installed-library
mutation was involved.

[Preservation](./preservation.txt) records 140 passing tests, including all 15 actual
native dry/after-step/processed combinations across clip, track, nested groups and
output. It includes existing composition, source audio and preview checks. The
[targeted native rerun](./restored-native.txt) followed a deliberate mutation: routing
`audioWindow` through generic `window` failed on leaked picture bindings
([failure](./video-dependency-mutation.txt)). Absolute sample bounds and complete PCM
checks remain unchanged after restoration. [Build and core types](./build-types.txt)
and [independent review](./review.txt) passed.

History/cache recovery, cancellation/retry, deletion refusal, full-WAV intrinsic
capacity preflight, malformed receipt refusal, unsupported retiming and picture tap
refusal are core checks. Native full-scale memory, excluded-source poison and
capture-context gates, and public tap delivery remain the live journey's work.
This pass does not establish listening quality or close 11a.

The base checkout's service typecheck has an unrelated project transcript-search
dispatch mismatch at `operations.ts:411`; current-root public routing must run its
integration types after this core commit. No service or protocol changes belong to
this pass.
