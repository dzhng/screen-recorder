I made no file edits, installs, downloads or inference runs, and didn't read other drafts. Everything below comes from the specs and the code on `main` at `729aedc5`.

# Draft: remaining slice graph for 19 (voice assets), risk-first

## Assumptions to kill early

1. **"Public-entry parity with 18" through a same-take extraction is probably impossible.** The frozen reference was made by ffmpeg: trim, then resample to 24 kHz and downmix to mono (`packages/test-harness/editing/voice-reproduction.mjs:27-48`). Production has no ffmpeg. The native path is `AudioPCMStream` resampling plus averaging, as used for Parakeet 16 kHz input (`helpers/mac/Sources/ScreenRecorderSpeech/SourceTranscript.swift:133-158`). Different reference samples mean different output. So byte parity can only be proven by importing the frozen `reference.wav` as-is. A same-take extraction produces new speech and needs its own listening verdict.
2. **Silent truncation.** With `max_tokens` = 256, generation stops at about 20.48 s (per the parameter audit). The worker's receipt doesn't say whether speech ended naturally or hit the token limit (`helpers/voice/worker.py:69-78`). A cut-off phrase would currently publish as success.
3. **The preset may advertise a value that does nothing.** Requested `repetition_penalty` 1.05 takes effect as 1.5. If sending 1.5 gives identical bytes, the public setting range should start at 1.5 and not advertise the lower values.
4. **Voice runtime has no network source.** `SpeechModels` only downloads files from the model hub (Hugging Face) as private 0o600 regular files. It has no executable bits, no symlinks and no local adoption (`packages/core/src/speech-models.ts:382-489`). Slice 19b explicitly leaves distribution out of scope. Public preparation can therefore only adopt a verified local runtime bundle.
5. **Each generation reloads the model.** 19a allows no resident worker, so every job pays the cold load. Observed: 40.5 s load, 66 s for the first word. The warm speed target (generation time at most 2× the audio length) doesn't apply per job.

## Slice graph

```
19b runtime relocation (in progress) ─┐
19c envelope probe (dev runtime) ─────┼─> 19f common model owner ─> 19g durable voice.generate ─┬─> 19i public settings
19d native reference exactness ───────┘                                 │                       │
          └──────────────> 19h voice.reference (reference acquisition) ─┴─> 19j placement and lifetime journeys ─> 19k room tone and listening
19e measured bounds (sweep; needs 19c) ───────────────────────────────────────> 19i
```

- **19b** (existing, in progress): relocated runtime reproduces the frozen output bytes exactly, with original paths denied. Kills the packaging risk.
- **19c** (inference, dev runtime): three questions only.
  - Is the end of speech distinguishable from hitting the token limit? Force a tiny `max_tokens` to find out.
  - Is requesting 1.5 byte-identical to requesting 1.05?
  - Is each setting actually forwarded, shown by a receipt?
- **19d** (native, no model):
  - Does an already-24 kHz mono Float32 WAV pass through native extraction with every PCM sample unchanged?
  - How far does native extraction differ from ffmpeg for source range 1–6 s?
  - Is the downmix averaging, as recorded?
- **19e** (inference sweep): measure memory, time and output quality as the reference grows past 5 s. Also measure bounds for `maxTokens` and text length, the ranges of top_k (codebooks have 3072 and 2048 entries), top_p, temperature and seed, and the real language keys. Results go into one bounds table. Listening happens only at the chosen bounds.
- **19f** (depends on 19b): turn `SpeechModels` into one pinned-model owner.
  - Parakeet download behavior stays unchanged.
  - The voice entry adds hub-downloaded weights plus local adoption of the runtime (copy-on-write clone, with modes and in-bundle symlinks).
  - It hands out the `PreparedVoice` paths and delete the duplicated identity checks:
    - `apps/service/src/voice-pins.ts`;
    - the worker's per-call re-hashing of the whole model (`worker.py:29-37`).
  - Rerun 19a parity through the owner's handle.
- **19g** (depends on 19f and 19c): `voice.generate` as a durable job.
  - Settings are the preset plus seed only.
  - Parity gate: import the frozen `reference.wav`, generate, and require byte equality with the 18a outputs.
- **19h** (depends on 19d; can run parallel to 19f/19g): `voice.reference` turns an asset range (raw) or a project range with a tap (processed) into a retained 24 kHz mono Float32 reference asset.
- **19i**: widen the settings schema to the measured 19e table. Report requested and effective values.
- **19j**: live journeys for placement, the three reference origins, donor deletion, model-unavailable rendering, and package adoption.
- **19k**: room tone through ordinary edits, context outside declared windows unchanged sample for sample, audible judgment, and listening for the same-take native reference.

Deferred and named, not built here:
- runtime distribution to other machines (an open decision);
- a resident worker (only if 19g latency is rejected);
- the `stretch` fit, blocked on 14, which hasn't started;
- shipping `helpers/voice` in the installed app (cutover).

## API seams and types

- **Model owner** (`packages/core/src/models.ts`, replacing `speech-models.ts`):
  - A manifest is made of parts: `{id: "weights" | "runtime", source: {kind: "hub", repo, revision} | {kind: "local"}, files: {path, bytes, sha256, mode?, link?}[]}`.
  - Methods: `status(name)`, `prepare(name, signal, from?)`, `resolve(name)`. `resolve` throws `MODEL_NOT_PREPARED`.
  - Readiness uses the existing receipt check (inode and mtime).
  - `pins.json` has model hashes but no byte sizes, which the manifest needs.
- **Protocol** (hard cutover of `packages/protocol/src/operations.ts:755-765`):
  - `model.status {model}` and `model.prepare {model, from?: {runtime}}`, with `model` = `"speech"` or `"voice"`. The product skill must be updated too.
- **`voice.reference`**: `{source: {assetId, streamId, acquisitionId?, range} | {projectId, revisionId, range, tap}}`.
  - Job target is the asset or the project revision; artifact is `voice.reference`.
  - Result: `{assetId, frames, durationUs, sampleRate: 24000, channels: 1}`.
  - The asset records dependencies on its source media assets and acquisitions, not on the revision, so it survives donor deletion.
- **`voice.generate`**: `{reference: {assetId}, referenceText, text, settings: {preset: "reference", seed?, …19i fields}}`.
  - Job target is the reference asset.
  - Result includes `termination`, `settings.requested`, `settings.effective`, and the model, runtime, entry and reference identities.
  - The output asset is retained by the job owner, like `asset.import` (`apps/service/src/project-service.ts:216-219`), plus an asset dependency on the reference.
  - Any audio asset that is already mono 24 kHz Float32 is accepted, which keeps the parity path free of extraction.
- **Provenance**: add typed `voice-reference` and `voice` variants to `AssetProvenance` and `portableAssetSchema` (`packages/core/src/assets.ts:106-124`). Don't pack JSON into the `source` string.
- **Model-unavailable at request time**: refuse before admission with a retryable error, following the `audio.prepare` pattern. The executor re-checks when it runs.
- **Replay**: queue dedupe on target, artifact and input hash makes a lost-response replay a plain resubmit (`packages/core/src/jobs.ts:572-738`), so no `requestId` table is needed.
- **Settings the schema rejects outright**:
  - `stream`, which changes output quality;
  - `speed`, `instruct`, `voice`, `split_pattern`, `min_p` and `repetition_context_size`, which the reference path ignores.
- **A token-limit hit** fails the job without publishing and returns the frame count as evidence.

**Single-owner rules**:
- one job queue, one asset store, one model owner, and one worker binding (`apps/service/src/voice.ts`);
- one extraction path, the native `AudioPCMStream`;
- no voice registry or enrollment object;
- the frozen preset stays exact.

Rename `voice.generatePrivate` and the "Private entry" wording in 19f, since the entry bytes change there anyway.

## Gates

- **19a checks stay green**: the 13 actual-entry cases, the 30 shared-lifetime checks, and native-worker framing.
- **Parakeet and model-operation tests stay green.**
- **Exact-byte gates**:
  - relocation (19b), owner handle (19f) and public entry (19g) all match the 18a outputs with zero tolerance;
  - 19d proves reference passthrough PCM is exact.
- **Lifecycle** (19g):
  - crash, cancel with drain, and lost-response resubmit;
  - failure with no mutation and no partial files;
  - `MODEL_NOT_PREPARED` states.
- **19j, through the real CLI/MCP**:
  - `voice-assets.mjs --case pronunciation-replacement`;
  - replace with `exact`, `trim`, `ripple`, `hold` or `silence`, plus insert;
  - processing `keep` versus `reset`, and undo;
  - donor project deleted after acquiring the reference, then generation and playback still work;
  - preview/export with the model directory invalidated;
  - package adoption into a library with no model;
  - the three reference origins with real, separate lifetimes.
- **Listening (19k and 18)** stays independent and non-blocking:
  - use complete sentences from the user's own recording and one clear question;
  - the 120 ms entrance verdict is still pending;
  - numbers never substitute for listening.

## Proven vs unknown

**Proven**:
- 19a private parity and refusals (`specs/agent-editing/assets/19a-voice-entry/review.md`).
- Shared process and staging owner (`voice.ts:76-156`).
- Queue dedupe, retry and cancel; the heavy lane runs one job at a time (`jobs.ts:28`).
- Asset-owned dependencies travel in packages (`assets.ts:570-582`, `project-package.ts:192-193`).
- A mono asset plays into stereo as both channels (`AudioPCMStream.swift:106`).
- Project audio windows are fixed at 48 kHz stereo (`packages/composition/src/execution-window.ts:37`).
- `audio.prepare` covers only full project output, and `audio.get` doesn't create an asset.
- The replace and insert edits exist (`packages/composition/src/edits.ts:105-131`).

**Unknown**:
- Whether the MLX/Metal libraries and the Python distribution relocate.
- Whether the end-of-speech vs token-limit signal is observable.
- Whether 1.5 and 1.05 give identical bytes.
- Whether native passthrough is exact.
- How memory, time and quality scale with reference length.
- The language keys and seed range.
- Library storage: gigabytes per library, and free space is already short (24j).
- Whether any reclamation ever removes an unplaced asset retained only by a job.

**Two items the plan needs from the user**:
- **Voice runtime source.** Only local adoption is possible right now, so users on other machines can't prepare voice until a distribution decision is made.
- **Split reference and generation into two operations.** The alternative is one `voice.generate` that extracts the reference itself. The split is recommended because a retry after donor deletion otherwise fails, because a reference can be reused without re-extracting, and because extraction then has one owner.
