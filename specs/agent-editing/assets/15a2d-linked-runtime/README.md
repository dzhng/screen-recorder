# Linked RNNoise runtime evidence

The [checkpoint](../../slices/15a2d-linked-denoise-runtime.md) binds the unchanged fixed mono adapter to native composition and existing prepared jobs. This is initial mono/structural-dual-mono execution evidence, not whole 15a2/15a acceptance. No listening or playback was performed. The user's unfamiliar word-crop feedback reported no obvious artifacts but did not establish intelligibility or word retention; later auditions must use meaningful complete sentences from their recording with the original alongside.

All six complete original/clean reference, noise and mixture inputs from `12c-matched-noise/audio` and `12c-clean-reference/native-level/audio` match their frozen processed PCM byte for byte through the linked worker. Those are numerical research fixtures, not new user-speech quality judgments. The replay retains every source WAV, rendered PCM WAV, oracle input/output, compiled request and native response, plus public delivered WAVs and MP4s.

The linked report contains 26 checks: complete frozen comparisons, requested-range/full equality, shared split continuity, independent-reset negative, current-trim recomputation, gain-before/after noncommutation, different current prefixes on shared split members, nested state steps, two state boundaries inside a block with decoder resumption, parent internal gap/downstream routing, zero-sample component and model/format/support/activation/dependency refusals. The original gap-routing red and its green remain in logs. Historical recipe/poison/channel/listening evidence remains unchanged in 12c/15a1; this pass does not replace those gates.

Public CLI/MCP confirms learned preparation, pinned old revision reuse, explicit retry, canceled completed native reply not published, exact full/range retained PCM, full/range movie creation and durable export byte-identical to the full preview. A separate in-flight cancellation observes a nonempty, incomplete RNNoise output spool before calling `job.cancel`; it verifies canceled status, no publication and an empty attempt workspace. Its single local duration is an observation, not a latency guarantee. The 600-second authored-silence domain exists solely to ensure inference is still active at cancellation; it is never completed or auditioned.

After restart, the fixture makes capability discovery and mixing unavailable. A fresh range read of the published PCM still succeeds, while a new preparation request refuses. This proves retained-consumer independence from current execution availability inside the linked worker; it does not prove a model-absent binary. Movie evidence establishes delivery and reuse, not encoded PCM equality or human playback quality.

Focused gates passed 64 composition tests, 33 core tests with one separately native-only skip, 12 service tests, TypeScript builds and the native composition stream test. Metadata startup required updating fixture workers that previously treated every operation as a media probe; their original red results are retained. The attempted non-48 kHz execution probe was already refused by the existing literal 48 kHz request schema, so no duplicate rate restriction was added. A malformed export identifier in an early harness run is retained as a harness error, not a product failure.

Independent design review led to explicit parent-gap routing, exclusive prefix views, decoder repositioning and selected-support diagnostics. Independent diff review found a duplicated native dependency reconstruction; it was removed so the compiler stays the sole dependency owner. Follow-up review found no remaining concrete issue. Both reviews were read-only and did not claim listening, stereo or broad portability acceptance.

The direct linked build measured 23.96 seconds in an existing checkout; the combined reader/publication build measured 9.74 seconds. Neither is a clean-build benchmark. Missing prepared-model verification produces an actionable local-preparation error, and the same staged file was restored and hash-verified. Source/model provenance, notices and unresolved external model redistribution licensing remain explicit in the parent contract.

`manifest.json` maps 162 original file names to 140 unique archive blobs using `storedAs`; every logical member remains addressable and SHA-256 checked. The 52.61 MB logical capture set has 45.75 MB unique bytes, compressed to 22.59 MB. `verification.json` pins the worker, frozen reference, model archive and scope. `SHA256SUMS` authenticates the archive and metadata. Archive validation streams each unique blob once, then verifies all logical mappings.

Reproduce from the repository root with the already available local frozen files; use new output directories:

```sh
node helpers/denoise/prepare.mjs /tmp/screenrec-rnnoise-model.tar.gz
node helpers/denoise/prepare.mjs --verify
swift build --package-path helpers/mac --product screenrec-native
bun run --cwd packages/composition build
bun run --cwd packages/core build
bun run --cwd apps/service build
SCREENREC_NATIVE="$PWD/helpers/mac/.build/debug/screenrec-native" \
  node packages/test-harness/editing/denoise-runtime.mjs \
  --out /tmp/new-linked-check --reference /tmp/screenrec-rnnoise-api
SCREENREC_NATIVE="$PWD/helpers/mac/.build/debug/screenrec-native" \
  node packages/test-harness/editing/denoise-runtime-public.mjs \
  --out /tmp/new-public-check --source /tmp/new-linked-check/source.wav
```

The public runner uses the existing built CLI through JourneyService; build the CLI dependency closure first in a fresh checkout. Local paths recorded in requests are provenance, not portable defaults. No native binary or trained model bytes are committed in this evidence archive.
