Recommend **four remaining implementation slices after 19b**, with delivery/listening acceptance inside the last slice:

```text
19a verified → 19b relocation, acceptance pending → 19c common preparation
                                           └──→ 19d configurable generation
existing asset/audio infrastructure ───────────→ 19e retained reference excerpts
19c + 19d + 19e ───────────────────────────────→ 19f public durable generation + placement
```

This is the smallest defensible ladder I found. Collapsing 19c–19e into public generation would combine unresolved runtime preparation, parameter support and audio extraction before there is a focused failure verdict.

**19c — Common model preparation**

Contract: public model discovery/preparation resolves both existing ASR and the frozen voice model/runtime through one owner.

Existing `packages/core/src/speech-models.ts:224` is an ASR-specific `SpeechModels`, with one manifest, one preparation flight and a shared `.staging` cleanup. Instantiating it twice is not a safe general registry. Refactor the owner into a common manifest-keyed preparation store; preserve ASR behavior through that owner rather than introduce `VoiceModels`.

Concrete seams:

```ts
type ModelId = /* manifest-owned finite identifiers */;
type PreparedModel =
  | { kind: "transcription"; /* existing native request */ }
  | { kind: "voice"; runtimeIdentity: string; modelIdentity: string;
      python: string; entry: string; model: string; cache: string };

models.list();
models.status(modelId);
models.prepare(modelId, signal);
models.requirePrepared(modelId);
```

Extend existing `model.status/prepare` and discovery in `packages/protocol/src/operations.ts`; service startup owns preparation lifetime. Preserve established ASR defaults if required by its current consumers, without a duplicate endpoint family.

Review surface: CLI/MCP shows readiness, byte progress, artifact identity and platform requirements; two model identities cannot collide in staging or cancellation. Missing/modified voice runtime never reports ready. After preparing, deny development runtime paths and network and run the frozen requests with exact complete-WAV parity. Keep ASR preparation/transcription tests green.

Unresolved prerequisite: 19b proves a relocatable local artifact, **not an available distributable artifact or download source**. Before finalizing this slice, explicitly choose the preparation supply route. Local import of the verified bundle can be specified concretely; downloadable distribution needs its own artifact provenance and delivery evidence. Do not hide a `pip install` behind `model.prepare`.

**19d — Full supported configurable generation**

Contract: typed configurable controls preserve the exact frozen preset and report requested versus effective settings honestly.

One configuration owner feeds the public protocol, capability discovery, job identity and worker. Replace private “only exact frozen settings” validation in `helpers/voice/worker.py`; retain the frozen preset as an immutable regression fixture, not a second implementation.

Proposed seam:

```ts
type VoiceSettings = {
  seed: number;
  temperature: number;
  topK: number;
  topP: number;
  repetitionPenalty: number;
  maxTokens: number;
  language: SupportedLanguage;
  // streaming controls only with separately verified decoding support
};
type VoiceCapabilities = {
  presets: /* frozen preset plus any explicitly accepted additions */;
  settings: /* supported values, measured bounds, effective semantics */;
  admission: /* coupled reference/text/output work limits */;
};
type VoiceReceipt = {
  requestedSettings: VoiceSettings;
  effectiveSettings: /* actual forwarding/clamps/filter behavior */;
  frames: number;
  sampleRate: number;
  durationUs: number;
  termination: /* measured EOS versus token bound, if observable */;
  referenceSha256: string;
  modelIdentity: string;
  runtimeIdentity: string;
  sha256: string;
};
```

The frozen preset remains exactly `temperature=.9`, `top_k=50`, `top_p=1`, requested `repetition_penalty=1.05`, `max_tokens=256`, `lang_code=english`, `stream=false`, seed `18`; effective repetition penalty is `1.5`.

The pinned audit at `specs/agent-editing/assets/19a-voice-entry/parameter-recon.md` establishes forwarding, **not safe bounds or quality**. Its required experimental gate should become this slice:

- Change one supported control at a time; capture worker forwarding, effective receipts and repeatability.
- Exercise EOS/token termination and complete-sentence output.
- Measure reference length, text length and output budget together for time/memory admission.
- Reject nonfinite/malformed inputs and unknown language keys.
- Do not advertise ignored `speed`, `instruct`, `voice`, `split_pattern`, `streaming_context_size`, `min_p` or `repetition_context_size`.
- Treat streaming as a separate decoding configuration with its own output/listening gate. It cannot be silently equated with nonstream delivery or permanently removed merely to simplify transport if full supported configuration is required.

No speculative numeric envelope should become a public promise. Five seconds and 1 MiB are private19a limits, not model capabilities. Experimental choices here determine the subsequent protocol bounds and therefore must be recorded before 19f.

**19e — Retained reference excerpts**

Contract: an explicitly selected raw or processed region becomes an ordinary immutable audio asset reusable independently of its donor project.

Use `AssetStore` and `ResourceReferences`; avoid a voice enrollment registry or separate reference blob store. This is an audio asset preparation seam useful for references **and room tone**.

```ts
type AudioExcerptRequest = {
  requestId: string;
  source: /* existing asset-stream or pinned project/target selection */;
  range: /* explicit clock-domain interval */;
  tap: /* explicit existing raw/processed selection */;
  outputProfile: /* canonical reference WAV or retained mix audio */;
};
type AudioExcerptReceipt = {
  assetId: string;
  streamId: string;
  sourceSelection: /* pinned revision/source, stream, range, tap */;
  processingIdentity: /* relevant frozen processing generations/settings */;
  frames: number;
  sampleRate: number;
  durationUs: number;
};
```

Current `audio.prepare` in `packages/protocol/src/operations.ts:804` only retains the **full project output** at 48 kHz stereo. It is not already arbitrary reference extraction. Extend/consolidate audio preparation around the selection seam; do not build another renderer for voice. Canonical 24 kHz mono Float32 conversion belongs at this preparation boundary and must preserve frozen fixture bytes.

External files enter through `asset.import`. Current/past project selections pin their revision and processing during extraction; successful publication retains the resulting excerpt, and later generation depends on the excerpt rather than donor existence. If the transcript accompanies a reusable reference handle, place its typed provenance on the existing asset/publication metadata path, not a separate lifecycle.

Gate: demonstrate current-project, imported-file and past-project inputs; then delete donor project and original external file. The acquired reference remains inspectable and usable. Raw/processed selections produce distinguishable expected samples and truthful provenance. Cancellation/restart never publishes an incomplete reference.

Existing `AssetProvenance` only has `{kind, source?}`; `portableAssetSchema` is similarly narrow. Typed provenance and package preservation need deliberate treatment rather than JSON hidden inside `source`.

**19f — Public durable generation and ordinary placement**

Contract: CLI/MCP `voice.generate` returns a shared job and publishes a saved generated asset; generation never mutates a project.

```ts
type VoiceGenerateRequest = {
  requestId: string;
  modelId: ModelId;
  reference: { assetId: string; streamId: string; range: /* explicit */ };
  referenceText: string;
  text: string;
  preset?: string;
  settings?: Partial<VoiceSettings>;
};
type VoiceGenerateResult = {
  jobId: string;
  // ready publication:
  assetId?: string;
  receipt?: VoiceReceipt;
};
```

The exact request must normalize into one frozen execution identity before admission. Replay returns the same saved output, including after lost response or model removal. Changed arguments under the same request ID conflict. Explicit retry retains inputs; a new seed/settings/text requires a new request.

Reuse `packages/core/src/jobs.ts` heavy lane, admission, dependency waiting and `StagedJobResult.publish()` fencing. Preserve process/drain ownership in `apps/service/src/worker.ts`, `render.ts` and `voice.ts`. Do not add a generation scheduler.

One shape decision must be explicit: generation has no output asset at admission. The existing `JobOwner` only supports import/asset/acquisition/project/recording. Prefer targeting the retained reference asset with the complete generation request as the artifact input, **if** existing queue artifact behavior supports independent concurrent recipes and publication discovery. Otherwise add a genuine generation-request target to the common queue; do not disguise it as an asset-import intent. Confirm this before implementation.

`AssetStore.import()` currently publishes inside its own transaction; `stagePortable()` provides a staged publication shape for a different use. Add/reuse a general staged asset publication seam so generated bytes, structured provenance, resource retention and successful job settlement share the attempt fence. Avoid publishing a ready asset from a canceled attempt.

Use existing replace/insert edits in `packages/composition/src/edits.ts`, preserving compatible target processing. Return actual duration; stretch/pad/ripple is a separate explicit agent choice. Room tone is an ordinary retained asset/layer with explicit gain, repetition and transitions.

Acceptance surface: the planned `packages/test-harness/editing/voice-assets.mjs --case pronunciation-replacement`, through actual public CLI/MCP and service paths.

Required verdicts remain separate:

1. Exact frozen preset complete-WAV/PCM parity.
2. Words pronounced as requested.
3. Speaker identity.
4. Level.
5. Entrance/exit timing.
6. Audible continuity with explicitly retained room tone.
7. Protected context unchanged outside declared transitions.
8. Visuals unchanged by audio replacement; ordinary undo works.
9. Donor deletion survival and model-unavailable playback/export from saved bytes.
10. Crash, cancel, worker failure, lost-response replay, stale-attempt publication fencing and explicit retry.

State tests cannot close listening. The parent’s unresolved slice18 listening gate remains unresolved until there is explicit acoustic evidence/verdict. No UI, lip sync, automatic passage selection, automatic denoising, wording choices or hidden fit decisions.

**Proven versus open**

- **Proven:** private19a exact candidate parity and worker lifetime/refusal checks; clean-process repeatability; pinned audit of actual supported/ignored argument forwarding.
- **Open:** 19b acceptance; public preparation/distribution; public parameter envelope and language capability projection; streaming quality; durable reference provenance; shared-queue publication; full public journeys and independent listening verdicts.
- Paths/status reviewed read-only; no files changed, installs, downloads or inference run.

---

Additional preservation note requested after the original draft: future canonical extraction must preserve already-canonical frozen 24 kHz reference bytes via exact pass-through. Re-encoding or resampling already-canonical references must not silently change WAV identity or samples. The full frozen reference selection takes the exact-byte path; actual selection/canonicalization work needs separately declared conversion provenance and gates.
