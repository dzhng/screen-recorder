The publication migration leaves existing tests and journeys with deterministic runtime failures, and incorrectly rewrites readers of unchanged local and archived data. Focused type checks pass, but they do not detect these failures.

Full review comments:

- [P2] Migrate the remaining job inspection consumers — /Users/server/dev/yap-exact-removal/packages/core/src/jobs.ts:808-812
  Removing `result` breaks consumers that were not updated: `capture-acquisition.test.ts` still asserts `result` at lines 325, 407, 513, 541, 560 and 619; `project-export-startup.mjs:27` dereferences `ready.result.cacheId`; and `audio-export.mjs:611` reads `encodedReady.result.contentFrames`. These checks now fail even when work completes successfully. Update the remaining inspection consumers to `published.output` alongside this producer change.

- [P2] Update both native preview-player fixtures — /Users/server/dev/yap-exact-removal/apps/macos/Sources/Yap/PreviewController.swift:212-212
  `apps/macos/tests/preview-player.test.mjs` still constructs `published.preview` in both scripted services, at lines 85 and 258. Both tests compile this production controller, so decoding now throws a missing-`output` error before playback starts. Update those fixtures to the new publication shape so the native playback checks remain usable.

- [P2] Read the project-index snapshot through its result wrapper — /Users/server/dev/yap-exact-removal/packages/test-harness/editing/package.mjs:595-595
  `projectIndexSnapshot()` returns the local object `{ result, coverage, hashes }`, not a job publication. Consequently, `original.published` is always undefined here, and the package journey throws while matching the first historical revision. Keep this lookup on `original.result.revisionId`; the synchronous `index.get` response and this local wrapper were not changed.

- [P2] Preserve the frozen voice receipt field — /Users/server/dev/yap-exact-removal/packages/test-harness/editing/acceptance-inputs.mjs:208-208
  `voice` is loaded from the unchanged historical `19f-public-voice-jobs/report.json`, whose paid-word receipt contains `published.audio`, not `published.output`. This expression therefore throws when the acceptance journey resolves its reference inputs. Preserve the historical field reader here; changing the live operation contract does not change archived evidence.

- [P2] Preserve the archived learned-audio checkpoint reader — /Users/server/dev/yap-exact-removal/packages/test-harness/editing/prepared-package-scale.mjs:76-76
  `original` comes from `report.json` extracted from the unchanged `24f-learned-scale/metadata.tar.xz`. That report still stores its second receipt under `published.audio`. The new lookup makes `originalAudio` undefined, so accessing its dependencies at line 80 aborts the checkpoint-restoration journey. Keep the archived receipt reader separate from the new live response readers.