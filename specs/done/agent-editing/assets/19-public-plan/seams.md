The clean cut is **capability policy → common preparation → retained reference asset → generation job → ordinary edit**. Keep the first four independently testable; placement must not become part of synthesis.

Read-only inspection completed. No files changed, installs, downloads, or inference run.

### What is proven

- **19a:** the private entry, frozen request/output parity, refusal behavior and process-lifetime gates are verified according to its retained evidence. This is not public settings support or listening acceptance.
- **19b:** runtime relocation remains unaccepted. Its on-disk slice says “planned”; the current handoff says work is in progress. Downstream readiness must wait for accepted relocation evidence.
- [parameter-recon.md](../19a-voice-entry/parameter-recon.md) is source inspection, not measured safe bounds or a quality sweep.
- [voice.ts](/Users/david/dev/screen-recorder/apps/service/src/voice.ts) and [worker.py](/Users/david/dev/screen-recorder/helpers/voice/worker.py) still enforce the private fixed recipe.
- At draft time, `SpeechModels` owned one ASR manifest, readiness, preparation flight and storage; both service entry points instantiated it and model operations accepted `{}`. The implemented successor is [Models](../../../../../packages/core/src/models.ts); this draft is historical evidence, not current operation documentation.
- [AssetStore](/Users/david/dev/screen-recorder/packages/core/src/assets.ts) already provides immutable bytes, generated origins, paged origins, retained dependencies and staged publication.
- [PreparedAudioStore](/Users/david/dev/screen-recorder/packages/core/src/prepared-audio.ts) demonstrates the desired `StagedJobResult` pattern: prepare/hash/probe bytes outside the transaction; publish metadata/dependencies inside the queue’s attempt fence.
- [JobQueue](/Users/david/dev/screen-recorder/packages/core/src/jobs.ts) already has asset targets, one heavy lane, bounded admission, retries, cancellation and input retention. Generation does not require a new queue or generation-owned scheduler.

### Proposed remaining graph

```text
19a verified ─→ 19b relocation accepted ─→ 19d common preparation
      └──────→ 19c measured capability policy
19c ─────────→ 19e retained references
19c + 19d + 19e ─→ 19f durable generation through CLI/MCP
19f ─────────→ 19g replacement/insertion and contextual acceptance

18 listening acceptance remains a separate required quality gate.
```

**19c — Measured generation capability policy**

One question: which controls and joint input/output envelopes does this exact pinned engine demonstrably support?

Own a typed engine capability descriptor and a request resolver. Presets are named default values, not restrictions preventing supported overrides.

Expose:

- Temperature, top-k, top-p, repetition penalty, max tokens, language and seed.
- The actual supported language keys.
- Requested settings separately from effective behavior.
- Joint limits on reference duration/frames, encoded/decoded bytes, reference/request text and output work.
- Streaming as a separately measured synthesis mode; do not describe it as equivalent transport.

Explicitly reject ignored controls: `speed`, `instruct`, `voice`, `split_pattern`, `streaming_context_size`, `min_p`, `repetition_context_size`.

Frozen preset remains exactly:

```text
temperature=0.9, top_k=50, top_p=1.0,
repetition_penalty=1.05 [effective 1.5],
max_tokens=256, lang_code=english, stream=false, seed=18
```

Do not change the frozen requested repetition value to “clean up” the clamp.

Gate: first compare the resolved frozen request and complete output with 19a; then change one supported control at a time, record actual effective behavior, termination, memory/time and complete-sentence quality. Include top-k vocabulary differences, greedy temperature, top-p filtering-disabled behavior and language refusal. Streaming gets its own comparison/listening verdict before advertisement. No arbitrary public numbers should be invented from the private five-second test.

Deliverable: an inspectable capability/experiment report plus deterministic resolver tests. If safe envelopes remain unknown, the slice stays open rather than presenting private limits as universal capabilities.

**19d — Common model/runtime preparation**

One question: can the existing preparation owner supply truthful, verified ASR and voice readiness without development-path dependence?

Promote `SpeechModels` into the common preparation owner; keep ASR-specific manifests and worker-request construction as engine descriptors. Move both service consumers in the same slice. Do not keep an old ASR store and add a voice store beside it.

Proposed seam:

```ts
type PreparedEngine =
  | { kind: "transcription"; modelId: string; /* existing verified native request */ }
  | {
      kind: "voice";
      modelId: string;
      modelIdentity: string;
      runtimeIdentity: string;
      entryIdentity: string;
      python: string;
      entry: string;
      model: string;
      cache: string;
    };

interface ModelPreparation {
  list(): ModelDescriptor[];
  status(modelId: string): ModelStatus;
  prepare(request: PrepareRequest, signal: AbortSignal): Promise<void>;
  resolve(modelId: string): PreparedEngine;
}
```

Paths are execution locations; complete content manifests are identity. The voice descriptor consumes the accepted 19b closure. Repeated preparation joins/reuses the existing preparation lifecycle. Status and inference remain offline.

Public discovery belongs in the common `model.*` protocol, including capabilities. Select `modelId` explicitly; update existing consumers rather than hiding a second default registry.

Gate: relocated local artifact admission, restart, changed/missing runtime/model bytes, cancellation cleanup and ready-state idempotence; ASR preparation/transcription regression checks. Run frozen parity through preparation’s returned receipt.

**Scope decision to settle in this slice:** 19b proves an installed-byte runtime artifact, not an obtainable distribution. The smallest supported first path is explicit verified local artifact admission into managed storage. Downloadable runtime distribution, installer strategy and cross-machine portability need separate evidence; do not silently claim them from relocation.

**19e — Retained reference acquisition**

One question: after successful acquisition, does one immutable reference asset fully describe the actual audio/transcript used, independently of its donor?

Use current AssetStore and ResourceReferences. A reference is ordinary retained audio with typed provenance; it is not a voice enrollment or a separate voice library.

Proposed input:

```ts
type VoiceReferenceSource =
  | {
      kind: "asset";
      assetId: string;
      streamId: string;
      sourceRange: TimeRange;
    }
  | {
      kind: "project";
      projectId: string;
      revisionId: string;
      range: TimeRange;
      tap: ProcessingTap;
    };

type AcquireVoiceReference = {
  requestId: string;
  source: VoiceReferenceSource;
  referenceText: string;
};

type VoiceReferenceReceipt = {
  receiptId: string;
  assetId: string; // retained canonical mono 24 kHz Float32 WAV
  referenceText: string;
  source: VoiceReferenceSource;
  sampleRange: { start: number; end: number };
  conversionIdentity: string;
  sha256: string;
  frames: number;
};
```

External files use existing `asset.import` first; past projects use the same explicit source selectors. Existing project `ProcessingTap` must own raw/processed selection—no second voice-specific processing language.

Use the existing native source/project renderer boundaries from [audio-inspection.ts](/Users/david/dev/screen-recorder/packages/core/src/audio-inspection.ts), then one explicit canonical conversion. Cache paths are not durable references. Frozen canonical WAV input needs an identity-preserving path so preprocessing does not accidentally change the parity fixture.

Extend asset-origin metadata with typed reference/generation provenance. Existing `asset_origins` permits multiple origins per content-addressed asset: **do not key transcript or reference identity solely by audio hash**, because the same bytes can be paired with different explicit transcripts or extraction provenance. A reference receipt identifies that pairing; avoid another mutable registry.

Acquisition retains source dependencies while executing. Successful publication retains bounded extracted bytes and sufficient immutable provenance; historical donor IDs are provenance, not playback/generation prerequisites. Subsequent generation retains the reference asset through existing job-input ownership.

Gate: raw source, explicit processed project range, external import and past-project origin; stereo/non-24k conversion; source-clock boundaries and gaps; exact receipt selection for identical bytes with different transcripts; delete donor after success, restart, and reopen/audition the retained reference. Do not delete donors before acquisition completes and call that equivalent.

**19f — Durable generation and public operations**

One question: do public requests produce one immutable, recoverable generated asset with complete effective provenance?

Use the admitted reference asset as `JobTarget { kind: "asset", assetId }`. This avoids inventing a synthetic generation owner merely to fit the queue. Add an artifact such as `"voice.generate"` and run on the existing heavy lane.

```ts
type VoiceGenerateRequest = {
  requestId: string;
  modelId: string;
  referenceReceiptId: string;
  text: string;
  preset?: string;
  settings?: VoiceSettings;
};

type ResolvedVoiceRequest = {
  reference: VoiceReferenceReceipt;
  text: string;
  requested: VoiceSettings;
  effective: EffectiveVoiceSettings;
  modelIdentity: string;
  runtimeIdentity: string;
  entryIdentity: string;
};

type VoiceGeneratedReceipt = {
  assetId: string;
  streamId: string;
  sha256: string;
  frames: number;
  sampleRate: number;
  channels: number;
  durationUs: number;
  request: ResolvedVoiceRequest;
};
```

One request resolver owns presets, validation and effective settings. Persist its complete canonical result at admission. Retry must not reread changed defaults, donor revisions or model versions.

Request-ID replay semantics follow asset-import precedent: identical replay returns existing work/result; a reused ID with a different request conflicts. Published work is reused, never regenerated to recover a lost response. A new creative variation requires an explicit changed seed/settings/request.

Execution uses `voiceRenderer` and the existing shared JSON worker lifecycle. Publish generated bytes and structured provenance via AssetStore’s staged publication under the queue attempt fence. Do not publish success before files are complete. Do not expose private paths as durable output identities.

CLI and MCP consume the same protocol schemas and service operations. The returned job uses existing `job.get/retry/cancel`; generated output remains inspectable through ordinary asset/audio operations. A ready response includes actual duration and requested/effective settings.

Gate: public frozen parity before further quality runs; CLI/MCP parity; crash before/after publication; cancel; lost response; retry with frozen inputs; simultaneous heavy work; stale attempt completion; malformed output; missing model/runtime; no project mutation on failure. Verify retained reference and generated bytes survive restart.

**19g — Ordinary placement and contextual quality**

One question: can an agent explicitly use the generated asset in a normal edit while preserving everything outside its declared change?

No `voice.replace` workflow. Use existing `edit.apply` insertion/replacement, normal fit/ripple/retiming and undo contracts. Generated duration is measured; the agent decides timing treatment explicitly.

Verify:

- Corrected word, complete phrase and insertion.
- Same-video, external-file and past-project references.
- Target-owned compatible processing preserved; source conditioning is not accidentally applied twice.
- Independent phrase gain and track processing.
- Explicit retained room-tone asset/mix and declared transition windows.
- Picture unaffected; no lip-sync/B-roll requirement.
- Undo and rendered playback with model/runtime unavailable.
- Donor deletion after acquisition.
- Unchanged protected context outside declared edits/transitions.

Run the planned public journey probe, with focused named cases rather than one giant assertion. Judge pronunciation, speaker identity, level, entrance/exit timing and continuity independently. Neither byte parity, lexical ASR success nor successful job publication satisfies listening acceptance.

### Ownership risks to resolve explicitly

1. **Provenance is currently too weak.** `AssetProvenance` is only `{kind, source?: string}`. Dumping JSON into `source` creates an untyped competing schema. Add typed structured provenance and preserve it through existing portable assets and origin pagination.

2. **Reference identity differs from asset identity.** Content deduplication must not collapse transcripts, processing choices or origin receipts.

3. **Project lifetime is the wrong generation owner.** A generation job tied to the donor project would conflict with donor deletion. Target the retained reference asset; keep donor identity historical.

4. **Prepared project audio is not the general reference API.** Existing `audio.prepare` prepares full processed 48 kHz stereo project output. Do not repurpose it silently into arbitrary selected mono reference extraction; reuse renderer/compiler ownership beneath it.

5. **Byte persistence and provenance dependencies differ.** Retaining the entire donor graph to explain a five-second reference defeats bounded independence. Preserve necessary provenance snapshots and retained audio; only actual replay requirements should become live resource edges.

6. **Private worker bounds are temporary validation, not a public capability registry.** Replace private fixed-request restrictions with the accepted policy in the owning slice; preserve frozen recipe parity rather than maintaining two production worker implementations.

7. **Unknowns remain real:** public parameter envelope, streaming quality, canonical conversion parity, reference-length memory/time, runtime distribution and contextual listening. Each has a named owner above; none should be quietly delegated to an implementer as “choose reasonable defaults.”

### Subsequent seam review

- Root's generic excerpt asset plus explicit transcript in the frozen generation request is the smaller seam. It preserves the necessary audio/text pairing when request identity includes both, so a separate voice-reference receipt API is unnecessary. The extraction result must still retain typed source/range/tap/conversion provenance. If equal excerpt bytes have multiple origins, freeze the caller-selected extraction provenance in the generation receipt or report that provenance is plural; do not silently choose one origin. No transcript or inference identity may be keyed solely by audio hash. A stable excerpt asset alone can be reused with another explicit transcript, with distinct frozen generation input.
- Root found that stagePortable publishes origins and retains supplied dependencies. Generation should generalize AssetStore's owned-byte staging/publication primitive, used by portable admission and generated assets, rather than manufacture a PortableAsset as the production generation interface. Queue-fenced publication remains the sole transaction owner.
- Root found that expanding SpeechModels' synchronous per-file inspect to a roughly 10,000-file runtime closure could stall the service. Common readiness/verification must use bounded asynchronous verification with yields and cached verified identity appropriate to immutable managed artifacts. A ready result still needs truthful invalidation and prepared execution checks; moving expensive verification off the synchronous status path must not weaken the artifact identity contract.
