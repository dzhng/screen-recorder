# Current implementation choices

This is a current-state decision ledger, not a release verdict. The toolkit supplies
primitives and makes zero editorial decisions; source media stays intact. Caller
ownership, best-effort speech, the selected 200 ms ambience, disposable fixture
library and iteration-speed principles are user givens rather than invented choices.
Reconciled against source **1b6aa64f**, with the documentation/installation
checkpoint **18fabb92** kept as a separate evidence authority. Required physical,
acoustic and release evidence retains its observed scope in the release disposition.
The user accepted those remaining limitations when authorizing this personal release.

Every entry below names the surviving decision, its concrete scenario, what was left
unspecified and the consequence future work inherits. Historical corrections,
implementation sequencing and gate results are excluded. Confidence ranks whether
the user would likely make the same call, not a claim that every acceptance gate passed.

## Sound — medium confidence

### Choose ordinary compressed timing fixtures

**When:** Origin in `9b839582`; prior ledger location 8–23.

A developer needs to see which picture appears across a cut. Small numbered, asymmetric clips use low frame rates and ordinary High-profile H.264 rather than a less broadly supported lossless profile. Their visible identities make timing inspectable; codec color allowance is separate from frame identity.

**Gap:** The corpus plan required deterministic asymmetric media without choosing a codec or frame rate.

**Reach:** These fixtures constrain timing and basic geometry checks; they do not define production motion quality.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [README.md](../../../packages/test-harness/editing/README.md).

### Return the entire inverse time interval

**When:** Origin in `9b839582`; prior ledger location 87–98.

A slow clip maps several project microseconds to one source microsecond. Reverse lookup returns the whole corresponding exact project interval and the first integer project time, which can be absent if fast playback skips that bin. A held frame maps to its complete hold.

**Gap:** The plan required inverse lookup without defining its many-to-one result.

**Reach:** Evidence and callers cannot assume a source timestamp has one project timestamp.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [README.md](../../../packages/composition/README.md).

### Reuse decoders but isolate conversion filters

**When:** Origin in `9b839582`; prior ledger location 110–125.

Several ordered selected intervals share one decoder, but each cut starts a fresh rate-conversion filter so excluded samples cannot influence the cut. A source gap beyond the existing finite seek threshold restarts reading instead of walking arbitrarily far through discarded audio.

**Gap:** Cut isolation did not specify decoder/filter reuse boundaries.

**Reach:** Reader reuse remains bounded; arbitrary reordering must obtain an appropriate reader.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [AudioSource.swift](../../../helpers/mac/Sources/ScreenRecorderAudio/AudioSource.swift).

### Retain a safe extension without making it identity

**When:** Origin in `9b839582`; prior ledger location 213–225.

Two equal files share the same content hash, while the first admitted copy retains a bounded safe suffix so native decoders can open it. The probe determines media kind from bytes; a misleading or absent suffix can still produce a truthful decode refusal.

**Gap:** Managed filename layout was unspecified and extensionless files were not universally accepted by the platform.

**Reach:** A pathname suffix never becomes codec authority or another asset identity.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [assets.ts](../../../packages/core/src/assets.ts).

### Bound removal requests without dividing commits

**When:** Origin in `9b839582`; prior ledger location 264–270.

An agent names many overlapping ranges in one removal. The reducer merges their union and applies it against that operation’s pre-state, under the existing per-operation range bound. It does not split an oversized request into hidden commits.

**Gap:** The multi-range input needed a finite public cardinality.

**Reach:** Large edits retain caller-visible atomicity and explicit refusal.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [edits.ts](../../../packages/composition/src/edits.ts).

### Move the expanded selection as one group

**When:** Origin in `9b839582`; prior ledger location 290–300.

Linked audio begins later than its video. A move destination names the earliest start of the expanded selection, retaining the audio delay regardless of argument order. Moving only two members of a four-member link gives the moved subgroup a fresh link identity while stationary members retain the original link.

**Gap:** The move origin and subgroup identity after partial selection were unspecified.

**Reach:** Commands must explain that the expanded group lands at the destination.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [edits.ts](../../../packages/composition/src/edits.ts).

### Ripple move uses the finished destination

**When:** Origin in `9b839582`; prior ledger location 403–415.

A two-second clip moves from the beginning to ten seconds. Its old occupied windows close first and it starts at ten in the resulting timeline. Separated selected pieces retain their spacing while their full envelope opens at the destination; changing only track at the same time opens no gap.

**Gap:** Destination coordinates before or after old-time removal were unspecified.

**Reach:** Conveniences must translate to final coordinates rather than make callers add back removed duration.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [edits.ts](../../../packages/composition/src/edits.ts).

### Padding expands into linked ordinary pieces

**When:** Origin in `9b839582`; prior ledger location 453–466.

One second of replacement audio fills a two-second slot using explicit silence fit. The prefix keeps the old occurrence ID and the new silence tail gets a normal identity linked to it. Video hold fit adds its ordinary held tail. Lineage exposes both; linked scope edits the full result and selected scope can edit one piece.

**Gap:** Fitting policies did not specify their persisted representation.

**Reach:** One source clock per media clip survives; old attached descendants retire even if the prefix selects the old source.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [edits.ts](../../../packages/composition/src/edits.ts).

### Worker budgets charge selected work rather than discarded prefix

**When:** Origin in `9b839582`; prior ledger location 733–746;1017–1052;4029–4070.

An agent previews the final second of a long asset. Its finite worker allowance charges startup and selected work, not the discarded earlier recording. Stateful and retimed requests additionally charge complete prerequisite contexts once per exact recipe/rate. Retained PCM does not charge inference that is not performed.

**Gap:** Deadline formulas and shared prerequisite accounting were unspecified.

**Reach:** Budgets reflect actual admitted work; they do not guarantee throughput on every host.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [project-render.ts](../../../apps/service/src/project-render.ts).

### Deduplicated role bytes require equal acquisition support

**When:** Origin in `9b839582`; prior ledger location 858–889.

Microphone and system files can hash to one asset/stream. Their capture binding combines authentic roles only if their support histories agree. Differing support refuses rather than selecting the first or unioning histories the caller cannot distinguish.

**Gap:** Content deduplication exposed a collision in context identity.

**Reach:** Asset identity does not erase capture-history selection meaning.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [acquisitions.ts](../../../packages/core/src/acquisitions.ts).

### Query checkpoints are disposable pinned evidence

**When:** Origin in `9b839582`; prior ledger location 980–997.

A caller pages a long transcript and its cached checkpoint is evicted. The continuation refuses and a new traversal is required; it cannot silently resume against newer source generations. Bounded recent revision contexts remain disposable indexes rather than permanent read sessions.

**Gap:** Resumable pinned reads needed a storage/lifetime representation.

**Reach:** No read-session database or hidden generation switch becomes another authority.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [project-evidence.ts](../../../packages/core/src/project-evidence.ts).

### Classic WAV has an explicit large-file ceiling

**When:** Origin in `9b839582`; prior ledger location 955–979;1017–1052.

A full-source float WAV would exceed its 32-bit container size. Native refuses before creating oversized output, with its own header reserve; core preflight separately uses the minimum RIFF size and publication checks actual bytes. RF64 is not silently substituted.

**Gap:** Supported large-file container and preflight precision were unspecified.

**Reach:** Long audio capacity is finite and format-specific, independent of bounded read memory.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [audio-inspection.ts](../../../packages/core/src/audio-inspection.ts).

### Published cache capacity is separate from working-file cost

**When:** Origin in `9b839582`; prior ledger location 1017–1037.

A source extraction can fit WAV while exceeding a smaller cache budget. The shared default is four GiB and active leases protect reads; known minimum output size is checked before rendering. Free space can still change, and in-progress spools are outside this published-byte budget.

**Gap:** Full extraction did not prescribe retained derivative capacity.

**Reach:** Storage use is explicit; increasing cache does not prove memory or free-space guarantees.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [cache.ts](../../../packages/core/src/cache.ts).

### Continuation identity preserves literal submitted search text

**When:** Origin in `9b839582`; prior ledger location 1053–1078.

Matching ignores case and outer punctuation, but a cursor for “Okay so” cannot be reused with “Okay SO.” The exact submitted query stays in continuation identity even if these searches have the same matches.

**Gap:** Literal-versus-normalized identity was unspecified.

**Reach:** Optional retry/search selectors must agree with the pinned request rather than silently change it.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [project-transcript.ts](../../../packages/core/src/project-transcript.ts).

### AAC comparison uses matched domains and explicit numerical scope

**When:** Origin in `9b839582`; prior ledger location 1116–1177;2572–2589;4180–4199.

Two separate AAC seeks can return slightly different floating samples. Comparisons keep exact counts, clocks, channels and endpoint membership, with the existing bounded RMS/maximum difference policy for that declared seek comparison. Lossless and otherwise exact controls remain exact; a composition’s AAC oracle separately encodes its expected PCM at the same range/settings.

**Gap:** Independent lossy decoder/encoder invocations did not guarantee exact float identity.

**Reach:** This fixture-specific allowance is not blanket perceptual or codec acceptance.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [README.md](assets/11a-audio-extraction/README.md).

### Waveform defaults offer a declared overview

**When:** Origin in `9b839582`; prior ledger location 1211–1234.

A caller first asks for a whole long source waveform. Omitted resolution yields roughly a thousand bounded buckets, with exact bucket width/partial edges reported. Explicit fine resolution on too broad a range refuses rather than dropping short sounds.

**Gap:** Useful default resolution and response cardinality were unspecified.

**Reach:** Overview and detail remain caller-inspectable without changing source samples.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [audio-wave.ts](../../../packages/core/src/audio-wave.ts).

### Maximum-per-pixel raster preserves short events

**When:** Origin in `9b839582`; prior ledger location 1308–1325.

Many time buckets or frequency bins collapse into one image pixel. The plot draws the maximum density and labels it, so a brief click is not averaged away or erased by the final value. Both waveform channels share an amplitude scale; spectrum contrast is fixed and labeled.

**Gap:** Raster reduction and scale conventions were unspecified.

**Reach:** Display remains an aid, while numerical data retains every measured value.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [AcousticImage.swift](../../../helpers/mac/Sources/ScreenRecorderFrames/AcousticImage.swift).

### Cuts describe mapping changes rather than history or sound

**When:** Origin in `9b839582`; prior ledger location 1534–1577.

A clip changes rate while source position continues. The event names that mapping transition, not an audible click. A pure split preserving binding, rate and boundary adds no cut; the outer project beginning/end is not an editorial cut, while internal track entrances/exits can be.

**Gap:** The cut category did not define rate changes, pure splits or outer boundaries.

**Reach:** Evidence derives from immutable final mapping rather than clip IDs, edits performed or a detector job.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [project-cuts.ts](../../../packages/composition/src/project-cuts.ts).

### Project indexes use sparse explicit selection policy

**When:** Origin in `9b839582`; prior ledger location 1578–1628;1646–1666.

A storyboard samples its project periodically plus authored/temporal boundaries and both observed sides of scene changes. Unrepresented intervals stay unproven even if one source was still. A new cadence needs its own selection identity, not an editorial change.

**Gap:** Project density, tap scope and selection ownership were unspecified.

**Reach:** Retained pictures are observations, not a substitute for a complete movie.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [project-index-selection.ts](../../../packages/core/src/project-index-selection.ts).

### Pointer trails follow source history, not inferred cut intent

**When:** Origin in `9b839582`; prior ledger location 1693–1717.

A trimmed video requests an explicit source-time trail that can include motion just before the trim. Source availability and missing observations still constrain it; zero duration asks only for the current pointer. Pure splits retain identical pointer history.

**Gap:** Source attachment did not choose lookbehind semantics.

**Reach:** The engine cannot silently reset trails merely because an edit occurred.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [composition-pointer.ts](../../../packages/core/src/composition-pointer.ts).

### Backward pointer queries replay bounded history

**When:** Origin in `9b839582`; prior ledger location 1827–1846.

A shuffled clip requests source second ten then second two. The sampler restarts the existing forward history reader and charges the accumulated work count; a repeated hold also charges output requests even when no new source event is read.

**Gap:** Random-access inspection did not specify history residency or work accounting.

**Reach:** Highly shuffled or repeated output can refuse explicitly without an unbounded event store.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [pointer-schedule.ts](../../../packages/core/src/pointer-schedule.ts).

### Image residency follows active bindings

**When:** Origin in `9b839582`; prior ledger location 1914–1942;assets/15-layer-geometry/choices.md.

Two simultaneous occurrences of a photograph share one decoded image; once neither contributes, it can be released and a later repeat decoded again. Video readers retain their separate per-occurrence accounting, and source/stage/mask pixel budgets are checked before allocation.

**Gap:** Bounded residency and multiplied-work admission were unspecified.

**Reach:** Memory depends on simultaneous contributors rather than every image in the project.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [CompositionPictureExecutor.swift](../../../helpers/mac/Sources/ScreenRecorderFrames/CompositionPictureExecutor.swift).

### Conveniences append ordinary steps with explicit windows

**When:** Origin in `9b839582`; prior ledger location 2307–2334.

An agent adds a zoom after a crop or a fade after gain. The new step appends rather than replaces earlier authored work, and its window is active only there. A mid-clip fade-out does not silently hold zero afterward. Source/project shorthand times are whole microseconds; normalized clip fractions stay supported.

**Gap:** Convenience expansion and behavior beyond the window were unspecified.

**Reach:** The caller inspects/reorders the returned stack; the general curve API remains the complete expressive path.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [edits.ts](../../../packages/composition/src/edits.ts).

### Packages carry authenticated resource files within one JSON budget

**When:** Origin in `9b839582`; prior ledger location 2445–2455;3219–3231;3400–3410.

A large history/prepared recipe no longer fits the compact manifest. Version-three project archives store typed revision/resource metadata as hashed inventory members and hydrate them through admitted descriptors before readiness, under the existing aggregate 128-MiB JSON budget. Truncating history or processing is forbidden.

**Gap:** Complete metadata representation and working-memory budget were unspecified.

**Reach:** Finite package readiness remains explicit without a second lazy history interpreter.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [project-package.ts](../../../packages/core/src/project-package.ts).

### Balanced is a measured preset rather than a universal fidelity promise

**When:** Origin in `9b839582`; prior ledger location 2352–2372;2510–2527.

A caller chooses balanced encoding for a compact preview. It uses the existing middle quality/size settings; another explicit setting can favor a different tradeoff. Fine text/trails may soften through compression while timing and geometry remain separately contractual.

**Gap:** The requested preset did not prescribe its numerical settings or universal visual threshold.

**Reach:** A preset stays inspectable/reversible and does not approve arbitrary color or motion loss.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [output-settings.ts](../../../packages/composition/src/output-settings.ts).

### Font faces are scoped to immutable asset bytes

**When:** Origin in `9b839582`; prior ledger location 2373–2391.

Two fonts can expose the same PostScript face name. Text names the immutable font hash and exact face, while family/style are descriptive. Duplicate face names within one collection refuse and the collection has a bounded face-count envelope. Installed ambient fonts cannot substitute.

**Gap:** Explicit font identity and admission envelope were unspecified.

**Reach:** Rendering/history/package dependencies retain exact selected font bytes.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [assets.ts](../../../packages/core/src/assets.ts).

### Keep platform sparse materialization and sequential audio-role cost

**When:** Origin in `9b839582`; prior ledger location 2778–2792.

A sparse recording has many occupied runs. Canonical audio uses the measured platform composition/export representation and finalizes audio roles sequentially so their peak allocations do not overlap. Relative inefficiency alone does not justify a second MOV serializer or narrower source domain.

**Gap:** The platform mechanism/resource tradeoff was unspecified.

**Reach:** Source support remains exact; resource cost is finite but host-dependent and cancellation preserves inputs.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [CaptureAudioMaterializer.swift](../../../helpers/mac/Sources/ScreenRecorderCapture/CaptureAudioMaterializer.swift).

### Compile the fixed local denoiser and observe its identity

**When:** Origin in `9b839582`; prior ledger location 2652–2675;2819–2832;2916–2927.

Explicit hash-checked native-build preparation supplies the selected model to the linked worker. Startup makes one bounded metadata request to identify its compiled recipe; unavailable/malformed metadata leaves new learned execution unready while retained PCM and authoring still work. A worker change needs restart.

**Gap:** Packaging and service-instance capability binding were unspecified.

**Reach:** Runtime editing never downloads weights or selects a parallel denoising package.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [Package.swift](../../../helpers/mac/Package.swift).

### Give each output channel independent learned state

**When:** Origin in `9b839582`; prior ledger location 2904–2915;2998–3003.

Different left/right speech and noise receive separate instances of the selected mono algorithm over the same authored state interval. Lanes are prepared sequentially in the same attempt spool and published only after both counts are complete. The project mixer still duplicates mono according to its existing rendition.

**Gap:** The mono algorithm needed an explicit stereo state/transaction policy.

**Reach:** One lane cannot alter another detector; this adds no hidden downmix, linked detector or normalization.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [CompositionState.swift](../../../helpers/mac/Sources/ScreenRecorderAudio/CompositionState.swift).

### Recovery and orphan readers share filesystem authority

**When:** Origin in `9b839582`; prior ledger location 3029–3041;3081–3093;7596–7617.

A service dies while its native child still accesses an acquisition workspace or donor. Native holds inherited shared locks; cleanup needs exclusive authority and reports ACQUISITION_BUSY or RECORDING_BUSY instead of deleting live files. Root recovery deliberately covers the whole acquisition domain, including reservations without files.

**Gap:** Cross-process recovery/delete scope was unspecified.

**Reach:** Busy refusal remains retryable after actual child exit without a process registry or polling cleaner.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [acquisitions.ts](../../../packages/core/src/acquisitions.ts).

### Canonical recovery receives a fragmentation-aware finite allowance

**When:** Origin in `9b839582`; prior ledger location 3042–3052;3199–3209;3368–3376.

A sparse take has many segments but little PCM. Canonical verification/publication/cleanup get their existing finite fragmentation allowance plus byte-work allowance under the media-worker cap; controls return promptly because work remains asynchronous. Expiry retains sources with an explicit failure.

**Gap:** Duration alone did not predict canonical setup cost.

**Reach:** This is a conservative operational budget, not a universal throughput promise or changed control deadline.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [capture-cleanup.ts](../../../apps/service/src/capture-cleanup.ts).

### Each source keeps a portable immutable publication authority

**When:** Origin in `9b839582`; prior ledger location 5267–5284;5792–5816.

A primary or camera directory has a durable receipt tying allocated source identity, timing and canonical/proof byte hashes to a frozen journal copy. Camera retains its closed mapping locally too. Recovery reads that claim rather than reconstructing authority from surviving filenames or an implicit parent directory.

**Gap:** Publication/recovery source authority needed a self-contained representation.

**Reach:** Deleting donor paths cannot change independently admitted acquisition evidence.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [CaptureSourcePublication.swift](../../../helpers/mac/Sources/ScreenRecorderCapture/CaptureSourcePublication.swift).

### Capture admission uses the allocated source’s stable key

**When:** Origin in `9b839582`; prior ledger location 5507–5529.

A finished take is reported again after restart. The internal acquisition request key is capture plus allocated source ID, joining the same durable job. A conflicting explicit import or different donor/recording identity refuses; a new notification cannot create another import.

**Gap:** Replay naming and partial admission storage were unspecified.

**Reach:** One source identity governs independent primary/camera admission without another request table.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [acquisitions.ts](../../../packages/core/src/acquisitions.ts).

### Empty recovery reports absence only after authoritative closure

**When:** Origin in `9b839582`; prior ledger location 5954–5989.

An allocated take has an empty directory and no journal. After managed reconciliation proves idle inputs and owns that directory, native returns inputs-closed plus NO_SOURCE_MEDIA, zero duration and no invented tracks/receipt. Missing journal alone is only a typed trigger; journal-only consumers retain their prior error.

**Gap:** Zero-media result and optional journal lease boundaries were unspecified.

**Reach:** Permissions, live journal ownership, missing directory or unknown retained files cannot masquerade as proved empty source.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [CaptureJournalLease.swift](../../../helpers/mac/Sources/ScreenRecorderCapture/CaptureJournalLease.swift).

### Recovered support has a compact immutable identity

**When:** Origin in `9b839582`; prior ledger location 5918–5953;6033–6050.

A crash leaves usable sources without trusted ordinary completion. Native publication marks recovered status explicitly and hashes every verified support interval, not merely its final endpoint. Complete media/proof identity remains independently pinned, and generic journal completion facts stay retained rather than overriding shorter verified support.

**Gap:** Recovered mode and bounded complete support representation were unspecified.

**Reach:** Equal duration cannot conceal a gap or turn recovered publication into ordinary completion.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [CaptureSourcePublication.swift](../../../helpers/mac/Sources/ScreenRecorderCapture/CaptureSourcePublication.swift).

### Camera verification has one latest-request continuation and fallback

**When:** Origin in `9b839582`; prior ledger location 6474;6514;6664–6778;6911–6970;6500–6513.

While camera bytes grow, one owner coalesces the latest written observation request and responds to file events. Private filesystem clones isolate later writes but do not alone certify a complete prefix. It qualifies actual refresh/decode/presentation boundaries, retains complete sample objects and binds encoded-prefix proof before reusing picture hashes. Stop joins that work; failure uses full-scan publication. Early closed-source scheduling requires the qualified single occupied segment and complete native inventory; sources with several occupied segments retain the generic path rather than joining support by assumption.

**Gap:** Background progress, immutable views and codec closure were unspecified.

**Reach:** No fragment interval, keyframe setting or clone is treated as proof; the existing complete digest requirement survives.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [CameraMedia.swift](../../../helpers/mac/Sources/ScreenRecorderCapture/CameraMedia.swift).

### Private camera backpressure has finite refusal without changing Stop

**When:** Origin in `9b839582`; prior ledger location 6760–6770.

A speculative passthrough writer stops accepting samples. Its existing continuation checks cancellation and uses a finite thirty-second backpressure guard, then falls back to ordinary publication. The guard does not redefine the product’s ten-second completed Stop requirement.

**Gap:** Internal writer waits needed a bounded no-progress policy.

**Reach:** Unsupported continuation remains recoverable without an unbounded queue or relaxed external deadline.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [CameraMedia.swift](../../../helpers/mac/Sources/ScreenRecorderCapture/CameraMedia.swift).

### Voice assets use one prepared runtime and explicit transcript

**When:** Origin in `9b839582`; prior ledger location 3606–3649;3755–3767.

An agent reuses a reference audio asset with a different submitted transcript. That request has a distinct immutable identity. Common model preparation verifies its registered runtime/model inventories; the standalone Python environment carries its effective installed packages, with model bytes a separate input. No voice enrollment registry or implicit environment is introduced.

**Gap:** Runtime supply, transcript handle and effective environment identity were unspecified.

**Reach:** New inference requires measured local preparation, while historical receipts retain their original structural grammar.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [voice-generation.ts](../../../packages/core/src/voice-generation.ts).

### Repair only an empty valid voice sampling distribution

**When:** Origin in `9b839582`; prior ledger location 3668–3689;3781–3802.

Very small top-p rounding removes every valid next-token candidate. The registered runtime restores the first maximum-score token while preserving already nonempty filtering output. It does not claim ideal probability mass or repair invalid model scores; ignored backend speed and unverified streaming are not advertised as controls.

**Gap:** The selected backend’s numerical empty-support case lacked behavior.

**Reach:** Measured settings stay available without inventing a minimum top-p or replacing successful filtering.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [voice-profile-v1.json](../../../packages/core/src/model-data/voice-profile-v1.json).

### Model copying reserves finite destination margin

**When:** Origin in `9b839582`; prior ledger location 3650–3667.

Explicit preparation copies each pinned model/runtime file only when its size plus the existing 512-MiB reserve fits the destination filesystem. Other processes can still consume that space; failure remains retryable. Inspection/synthesis never installs implicitly.

**Gap:** Preparation required capacity checks without choosing the reserve.

**Reach:** The local operational margin is reversible but can refuse before literal disk exhaustion.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [models.ts](../../../packages/core/src/models.ts).

### Audio-only encoding reuses the complete PCM owner

**When:** Origin in `9b839582`; prior ledger location 6121–6132;assets/09c-audio-export/choices.md.

A caller requests M4A after an existing project mix. Encoding borrows the cached full WAV rather than mixing again, with a distinct rendition identity and resolved settings. This trades temporary disk space and the WAV ceiling for reuse; it does not introduce a direct-stream preparation path.

**Gap:** Standalone encoding’s preparation/lifetime seam was unspecified.

**Reach:** Changing encoding can preserve the unchanged exact mix and replay its original bytes.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [audio-inspection.ts](../../../packages/core/src/audio-inspection.ts).

### Use standard audio-only MP4 presentation for M4A

**When:** Origin in `9b839582`; prior ledger location assets/09c-native-audio-file/choices.md.

A requested M4A starts at its first authored sample. The existing ISO MPEG-4 writer produces an AAC-only compatible file with a standard edit list, excluding encoder priming from presented content. Presented frames and total decoded packet capacity are reported separately.

**Gap:** The dedicated platform M4A writer’s metadata did not establish the required timeline.

**Reach:** Packet padding never defines content duration and no new mux/codec dependency is selected.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [MovieMux.swift](../../../helpers/mac/Sources/ScreenRecorderWire/MovieMux.swift).

### Large compiled/probe payloads use existing attempt files

**When:** Origin in `9b839582`; prior ledger location 3016–3028;3105–3118.

A small requested window can have a many-megabyte prerequisite plan or physical metadata inventory. The service writes bounded authenticated payloads inside the locked attempt and native reads the same strict schema. It does not raise global control frames or invent a second plan meaning.

**Gap:** Bulk control delivery was unspecified.

**Reach:** Metadata size caps remain distinct from native framework allocations and project capacity.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [project-render.ts](../../../apps/service/src/project-render.ts).

### Storage categories measure shared actual bytes

**When:** Origin in `9b839582`; prior ledger location 4993–5008.

Two projects reference one immutable asset. Aggregate storage counts the file length once and does not invent each project’s share. Registered derivatives are cache bytes; models/external donors are excluded and managed unfinished capture donors remain accounted for by their lifetime.

**Gap:** Shared project files did not have a meaningful per-project allocation policy.

**Reach:** One contained cancellable scanner owns actual filesystem observation.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [storage.ts](../../../packages/core/src/storage.ts).

### Bound rename cleanup to the retained parent

**When:** Origin in `9b839582`; prior ledger location 7862–7904.

An attempt directory is renamed and another appears under its old name. Cleanup uses held directory identity and one scan of the retained parent to retire the original empty entry; moving it outside that parent does not authorize a machine-wide search. Direct producers verify known output inode; platform writers retain only authority they actually supply.

**Gap:** Rename scope and producer-specific leaf identity guarantees were unspecified.

**Reach:** The implementation does not promise arbitrary concurrent external leaf-replacement protection.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [OutputFile.swift](../../../helpers/mac/Sources/ScreenRecorderMedia/OutputFile.swift).

### Transport uses a conservative local inline budget

**When:** Origin in `9b839582`; prior ledger location 4354–4376;assets/24z11-operation-result-delivery/choices.md;assets/24z12-mcp-media-admission/choices.md.

The socket caller supplies its inline byte preference in the outer envelope, leaving operation schemas independent of MCP. One owner budgets structural plus worst quoted JSON copies and complete envelope/error overhead. Some otherwise deliverable results choose artifact delivery; standalone handlers lacking that lease owner refuse before dispatch.

**Gap:** Wrapper-aware delivery margin and handler ownership were unspecified.

**Reach:** Complete data survives without increasing control caps or teaching core MCP serialization.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [framing.ts](../../../packages/protocol/src/framing.ts).

### JSON inspection never spends a lease to discover it was too large

**When:** Origin in `9b839582`; prior ledger location assets/24z12-mcp-media-admission/choices.md.

An admitted JSON artifact may fit raw bytes but exceed the message once quoted. The adapter uses a conservative UTF-8/envelope estimate before reading, leaving the existing token live if automatic delivery cannot fit. Current owned error-body sizes participate in the same budget.

**Gap:** Pre-consumption capacity needed a bounded estimate without parsing leased bytes first.

**Reach:** Future error/envelope growth requires budget review rather than truncation or hidden loss of evidence.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [README.md](../../../apps/cli/README.md).

### Color comparison names the actual pixel domain

**When:** Origin in `9b839582`; prior ledger location 226–238;358–368;1170–1177;5385–5405;8099–8142.

A source-membership oracle compares decoded samples with authored RGB, while a PNG may have a different declared profile. Comparisons retain these original operands and separately convert complete images from actual profiles when asking color correspondence. Geometry/pointer masks cannot approve an unresolved whole-image color difference.

**Gap:** Raw values, rendered profile conversion and source membership were conflated.

**Reach:** No oracle-only explanation, changed tolerance or missing historical producer is treated as a production color correction.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [FrameImage.swift](../../../helpers/mac/Sources/ScreenRecorderFrames/FrameImage.swift).

### Geometry and pointer fixtures use independent changing landmarks

**When:** Origin in `9b839582`; prior ledger location 1682–1692;1792–1811;4125–4199;8099–8142;575–584.

A fractional moved clip can select the wrong frame while a static picture still looks plausible. Maintained fixtures use independently authored changing counters/landmarks and same-clock references, checking explicit geometric edges or pointer neighborhoods rather than deriving expected pixels from renderer receipts. Blank compressed frames have a separately defined all-pixel codec allowance.

**Gap:** Motion membership and geometry needed a falsifiable source oracle.

**Reach:** Fixture-specific raster tolerances stay scoped and do not become broad color or perceptual approval.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [README.md](../../../packages/test-harness/editing/README.md).

### Preserved fixture encoders use declared current settings

**When:** Origin in `9b839582`; prior ledger location 8209–8268.

A frozen pointer graph names H.264/Rec.709 but lacks historical implicit encoder defaults. A private fixture uses current balanced settings without tuning to resemble old bytes, carries the required video media tag and normalizes only schema-declared nil omissions. A video-only graph invokes the existing video-only owner.

**Gap:** Historical implicit settings and current strict wire shape were not identical.

**Reach:** Current paired output does not acquire old encoded-byte authority or a production compatibility adapter.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [README.md](assets/23-owner-fixture-ports/README.md).

### SDK cancellation fixtures observe actual owned phases

**When:** Origin in `9b839582`; prior ledger location 6474;8033–8098.

A cancellation check forwards the real writer finishing method/callback and identifies its exact writer before requesting cancel while it is unfinished. A sibling-failure check openly controls readiness to keep both original pumps unfinished, then triggers actual SDK failure with the caller task uncanceled. All observed callbacks/readers drain before restoration.

**Gap:** Natural tiny media did not reliably overlap the required finishing/pump phase.

**Reach:** Controlled scheduling proves that interleaving, not its natural frequency, and no product hook or fake completion is introduced.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [MovieMux.swift](../../../helpers/mac/Sources/ScreenRecorderWire/MovieMux.swift).

### Player observation is muted and uses actual time advancement

**When:** Origin in `9b839582`; prior ledger location 4095–4124;6862–6878;7990–8032.

A retained independently identified movie goes through the actual native controller/window/player. The test synchronously mutes the assigned player before play and observes delivered frames/end at their real timestamps, with finite first-output/progress allowances. A sampled spatial grid stays explicitly narrower than whole-frame or perceptual judgment.

**Gap:** Continuous presentation required observation without unsolicited sound/desktop changes.

**Reach:** Muted progress cannot stand in for integrated listening or every-pixel presentation.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [PreviewWindow.swift](../../../apps/macos/Sources/ScreenRecorder/PreviewWindow.swift).

### Measure independent workload axes and complete delivery

**When:** Origin in `9b839582`; prior ledger location 3441–3459;3488–3506;3537–3561;4275–4376;5141–5150;6780–6812;7946–7990;8186–8208.

A query-memory fixture changes duration while keeping clip count/rows fixed, or history length while keeping document size fixed; setup is outside the measured phase. A warm preview uses an uncached window rather than timing a cache lookup. Public timings include actual default-client retrieval/decoding while optional repeated diagnostic copying is disabled.

**Gap:** Scale plan did not prescribe isolation or measurement boundaries.

**Reach:** One axis result does not certify another family, host or cached/uncached path.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [README.md](../../../packages/test-harness/editing/README.md).

### Profiling keeps exact runtime authority and diagnostic scope

**When:** Origin in `9b839582`; prior ledger location 5133–5140;5222–5266;6075–6097;6780–6812.

A historical query worker is missing while current code progresses. Distinct retained source/module/runtime inventories qualify each profile; opt-in service sampling runs only over query delivery and bounds time/RSS/owned cleanup. Host load is observed and disclosed rather than assumed absent. Diagnostic CPU attribution never changes the latency requirement.

**Gap:** Attribution after missing worker and concurrent host activity needed qualified inputs.

**Reach:** No new production tracing or invented historical executable is introduced.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [choices.md](assets/24z-current-preparation/choices.md).

### Research methods preserve frozen comparison variables

**When:** Origin in `9b839582`; prior ledger location 301–343;1411–1453;1496–1517;1973–2004;3450–3459;3894–3910.

A bounded alternative speech/stretch/denoise trial keeps its original matcher, input, context, precision and recipe identity; a different conditioning mode, engine or context receives a separately named candidate. Synthetic zeros flush excluded-source processing tails; source guards are explicit selected input rather than hidden neighboring speech.

**Gap:** The risky mechanisms needed concrete experiment parameters without premature production adoption.

**Reach:** A local gain in one diagnostic cannot replace the selected runtime or create an automatic duration-based algorithm switch.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [choices.md](assets/13a-visual-clarity/choices.md).

### Annotation confirms the selected boundary rather than playback

**When:** Origin in `9b839582`; prior ledger location 4721–4770;4784–4826;4887–4930.

The listener clicks a waveform, hears a short preview beginning at that exact point and presses Next to confirm the fixed selected line, not the moving play cursor. Back revises and Skip leaves an unknown edge. The target list owns prompt order/word identity; no estimated boundary is prefilled.

**Gap:** The requested simple listening flow left selection and confirmation behavior unspecified.

**Reach:** Marks retain independent audible authority without a removal decision or a second labeling UI.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [choices.md](assets/12d-marking-page-ui/choices.md).

### Fixed audition construction declares every treatment

**When:** Origin in `9b839582`; prior ledger location 301–343;381–402;3929–3944;4410–4547;4657–4720;4827–4886;4947–4992.

A generated voice candidate can be matched by average signal energy to up to two seconds of original context on each side. A corrected phrase entrance can remove an explicitly declared 120 ms while preserving its later samples. These are separately retained fixture treatments, as are complete familiar sentences, authored stereo/noise, source-aligned endpoints and exact join envelopes. The normal untreated output stays available; exact PCM diagnostics count changed float encodings even when amplitude difference is zero.

**Gap:** Listening aids and comparison material were unspecified.

**Reach:** RMS is not perceived loudness, a marked word is not an automatic edit, and fixed audible approval cannot define global engine defaults.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [choices.md](assets/15a3-protected-sentence/choices.md).

### Fresh caller fixtures begin with unedited explicit inputs

**When:** Origin in `9b839582`; prior ledger location 4982–4992;5169–5177;6151–6168;6306–6354.

An external caller gets a short bounded brief, named protected content, actual human cuts, explicit canvas/output and admitted source clocks. Preparation creates an empty project and pinned inputs, not the developer’s completed preferred edit. It resumes interrupted setup with the same request IDs and supplied read-only retained-media root, refusing changed/edited inputs.

**Gap:** Independent caller acceptance lacked a concrete fixture and resumable preparation contract.

**Reach:** The caller chooses operations/layout; a real recording fixture never becomes an unsolicited tutorial-editing project.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [choices.md](assets/25-input-preparation/choices.md).

### Use explicit fixture devices and callback orders

**When:** Origin in `9b839582`; prior ledger location 5896–5917;6780–6812;6896–6910.

An established-primary camera control explicitly offers primary first and preserves its later prologue rejection; a separate camera-first control exercises new early support. A missing selected device is never substituted by product code. A separately authored available-device fixture can investigate a different lifecycle question with its own identity.

**Gap:** Historical fixture order and unavailable development device did not define the new requested case.

**Reach:** Fixture choices cannot become a camera fallback or physical synchronization claim.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [README.md](assets/23-owner-fixture-ports/README.md).

### Existing evidence is reused only within its exact authority

**When:** Origin in `9b839582`; prior ledger location 3166–3177;3768–3780;3803–3821;3945–3956;4599–4618;4657–4693;4771–4783;4846–4875;4931–4946;6176–6195;6370–6473;6600–6659;8330–8350; 24–37;3430–3440;4575–4598;6527–6559.

A saved media/worker packet can move directories only after hashes qualify the same complete bytes. Pinned workers live in content-addressed durable local storage; large artifacts may remain outside Git with explicit local full archives, while unique blobs plus filename maps and exact MOV-date patches avoid duplicate storage. Failed observation operands are persisted before assertions whenever the maintained observer can retain them. A developer regenerates the same fixture after updating the encoder. The pictures may mean the same thing while the container bytes change. The fixture records its generator, runtime and encoder identity rather than promising byte equality across unspecified versions. Reconstructing a retained large checkpoint authenticates its complete original recipe hash and preserves PCM provenance; it never manufactures missing original history. Timing container comparison excludes only six documented creation/modification date fields while retaining original hashes, not presentation clocks or media bytes.

**Gap:** Long-running work needed durable identity and bounded evidence storage. Determinism needed an explicit toolchain boundary.

**Reach:** Paths, aggregate manifests or reconstructed receipts cannot acquire missing original-runtime/full-content authority. Frozen evidence must retain its original producer or name a distinct new producer.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [README.md](assets/23-owner-fixture-ports/README.md).

### Room-tone fixture loops remain ordinary explicit tracks and curves

**When:** Origin in `9b839582`; prior ledger location 381–402;4430–4461;4657–4720.

A fixed review project repeats a caller-selected half-second quiet region. Each occurrence has its own audio track and content-clock gains, making outgoing and incoming selected samples explicit through the ordinary mixer. The user’s 200-ms treatment is a given; level-matched/+24-dB monitor copies and the rejected 250-ms comparison remain separately labeled fixture recipes.

**Gap:** Loop layout, curve anchoring and diagnostic monitor level were unspecified.

**Reach:** No automatic ambience selection, production loudness policy or parallel renderer follows from this fixed fixture.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [choices.md](assets/19-soft-roomtone-overlap/choices.md).

### Inspection limits are current refusal boundaries

**When:** Origin in `9b839582`; prior ledger location 996;1270–1289;1635–1645;1827–1872;1914–1967.

A request has too many selected sources/occurrences, a huge retained checkpoint or a compressed image that expands into excessive pixels. Current owners reject it before oversized work rather than silently sample less. Query context reuse is limited to four recent revisions; full project evidence has 10,000 selected occurrences, 1,024 source selections and eight-MiB manifest/checkpoint limits, and still decoding its shared 8192-by-8192 pixel-count ceiling.

**Gap:** Bounded work required concrete operational admission limits.

**Reach:** These are current supported-domain choices, not future implementation promises or universal memory/throughput acceptance.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [project-evidence.ts](../../../packages/core/src/project-evidence.ts).

### Exact audition envelopes are authored after the narration sum

**When:** Origin in `9b839582`; prior ledger location 4827–4845.

A fixed human-marked cut must reproduce its pinned native join samples including signed zero. The fixture applies its envelope to the combined narration track rather than independently faded sibling clips. Short ramps become explicit sample-held gain keys through the ordinary curve API; the older accepted fixture retains its own recipe.

**Gap:** The exact comparison required a public authoring representation without changing mixer arithmetic.

**Reach:** This bounded fixture data is not a new production fade processor or general cleanup policy.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [edits.ts](../../../packages/composition/src/edits.ts).

### Movie support represents only the exact fractional PCM remainder

**When:** Origin in `9b839582`; prior ledger location 7793–7816.

A movie ends between output sample cells. The existing mux preserves the floor-counted PCM and encoded media, then declares the remaining less-than-one-sample support as an empty audio edit in its bounded header. It accepts only its writer’s fixed one-audio-track grammar and refuses ambiguous/unrepresentable headers rather than adding a sample or re-encoding.

**Gap:** Exact presentation and unchanged PCM required a representation for platform-omitted remainder.

**Reach:** This is a private 64-MiB-bounded finalizer for this writer, not a general import repair parser or invented audio tail.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [MovieAudioTail.swift](../../../helpers/mac/Sources/ScreenRecorderWire/MovieAudioTail.swift).

### Project navigation remembers cursors and shares one observed page

**When:** Origin in `9b839582`; prior ledger location 5839–5874.

A user goes forward through Projects and then back. The native controller stores the public cursors for visited pages, requests five rows at a time in service creation order, and publishes one observed value to menu and Settings. Those views issue no independent library reads and keep no second catalog.

**Gap:** Bounded page size, backward navigation storage and view publication were unspecified.

**Reach:** Navigation stays small and service-owned; the page size is reversible presentation discretion rather than a large-library guarantee.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [LibraryController.swift](../../../apps/macos/Sources/ScreenRecorder/LibraryController.swift).

### Model tests replace only the external fetch boundary

**When:** Origin in `9b839582`; prior ledger location 6053–6074;6151–6168.

A scratch public model.prepare asks its ordinary owner to fetch each registered file. The fixture supplies already verified exact local bytes at that boundary and can hold or fail the external response; actual checksum validation, receipt creation, retry and reopen remain real. A fabricated ready receipt or scripted synthesis would bypass the contract being checked.

**Gap:** Readiness proof did not require live hosting/credentials for its local owner behavior.

**Reach:** This fixture does not claim a live network transfer or speech quality and does not prime an independent caller’s generation choices.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [models.ts](../../../packages/core/src/models.ts).

### Measurement probes stop visibly and recover by immutable content

**When:** Origin in `9b839582`; prior ledger location 3822–3855.

A camera probe reaches its finite five-million-observation bound and stops interrupted, retaining accepted media/mappings rather than continue with hidden missing evidence. Recovery names verified raw/mapping/candidate content; an existing equal output can satisfy replay, while a different output refuses without replacement. Moving the evidence need not preserve its original inode.

**Gap:** The finite observation envelope and probe replay identity were unspecified.

**Reach:** Probe limits do not become production recording caps, and caller-owned failed/raw evidence is not silently reclaimed.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [CameraMedia.swift](../../../helpers/mac/Sources/ScreenRecorderCapture/CameraMedia.swift).

### Public voice capacity is a registered joint envelope with truthful completion

**When:** Origin in `9b839582`; prior ledger location 3781–3802;3606–3625.

A caller supplies a canonical mono 24-kHz reference lasting up to twenty seconds—480,000 decoded frames, within the 1,985,536-byte encoded-reference limit—and chooses measured synthesis controls. The registered profile also bounds target tokens, total model input, request bytes and generated codes jointly. If generation reaches its code/output budget without the model’s end-of-speech signal, it fails as incomplete rather than publishing a chopped sentence. [The generation owner](../../../packages/core/src/voice-generation.ts) admits the exact request; the caller can make another explicit request or compose several generated assets, without hidden splitting or stretching.

**Gap:** Backend configuration alone did not establish safe local capacity or what reaching a budget meant.

**Reach:** A wider supported envelope requires a new measured immutable profile identity; operational capacity and completed speech are explicit, independently of already retained generation replay.

**Verdict:** sound. **Confidence:** medium.

**Owner:** [voice-profile-v1.json](../../../packages/core/src/model-data/voice-profile-v1.json).

## Sound — high confidence

### Distinguish acquired gaps from held pictures

**When:** Origin in `9b839582`; prior ledger location 40–54.

A generated video jumps forward in timestamp. The decoder may hold its earlier picture across the jump, so a separate declared acquisition mask marks unavailable time. A held decoded picture alone cannot establish that a camera acquired another frame.

**Gap:** The gap fixture did not specify how to represent actual acquisition absence.

**Reach:** Readers and oracles keep physical presentation, acquisition support and synthetic fixture metadata distinct.

**Verdict:** sound. **Confidence:** high.

**Owner:** [source-projection.ts](../../../packages/composition/src/source-projection.ts).

### Reuse one thumbnail by decoded buffer identity

**When:** Origin in `9b839582`; prior ledger location 55–70.

Thousands of short cuts visit the same held physical frame. Thumbnail reuse retains that exact buffer and one thumbnail, while every cut still emits its own timing row. A new frame or empty interval clears reuse; a timestamp guessed to be equivalent cannot supply identity.

**Gap:** Bounded native work did not prescribe a thumbnail cache key.

**Reach:** Future image-changing work must preserve the buffer identity boundary rather than grow an independent persistent cache.

**Verdict:** sound. **Confidence:** high.

**Owner:** [SourceVisualSamples.swift](../../../helpers/mac/Sources/ScreenRecorderFrames/SourceVisualSamples.swift).

### Keep probe summaries separate from sample inventories

**When:** Origin in `9b839582`; prior ledger location 71–86.

An agent imports a long movie. The probe walks actual presentation samples and edit-list mapping but returns count, first/last time and duration variation rather than a timestamp array for every frame. Exact picture selection still asks the native presentation owner.

**Gap:** Import metadata needed actual timing without an unbounded JSON inventory.

**Reach:** Summary metadata can describe timing variation; it cannot replace physical sample membership.

**Verdict:** sound. **Confidence:** high.

**Owner:** [SampleTiming.swift](../../../helpers/mac/Sources/ScreenRecorderMedia/SampleTiming.swift).

### Let attached children inherit unavailable support

**When:** Origin in `9b839582`; prior ledger location 99–109.

A title follows an occurrence that has an acquisition hole. Its authored envelope stays intact, but its available intervals also contain that hole. A project-time title placed independently remains independent.

**Gap:** Content attachment and source gaps needed an intersection rule.

**Reach:** Attachment never becomes permission to invent acquired source material.

**Verdict:** sound. **Confidence:** high.

**Owner:** [source-projection.ts](../../../packages/composition/src/source-projection.ts).

### Store exact selected and placed fractions

**When:** Origin in `9b839582`; prior ledger location 126–144;2543–2571;4200–4274.

A ten-microsecond source interval plays in six project microseconds. Splitting at project time two stores source time 10/3 rather than rounding it to three. The same representation preserves admitted physical endpoints and seeded-caption positions. Reduced safe-integer fractions are persisted; unrepresentable results refuse.

**Gap:** Integer-only documents could not preserve the affine mapping or exact admitted endpoint.

**Reach:** Reducers, packages and native lowering share one time representation instead of hidden original clocks or mutable speed fields.

**Verdict:** sound. **Confidence:** high.

**Owner:** [README.md](../../../packages/composition/README.md).

### Join import admission to queue admission

**When:** Origin in `9b839582`; prior ledger location 145–162.

An agent imports while the preparation queue is full. A synchronous request factory inside the catalog transaction either stores both the immutable import intent and its real job or stores neither. Asynchronous source inspection happens before that transaction; media work starts afterward.

**Gap:** Import intent and bounded queue admission needed one transaction owner.

**Reach:** New preparation owners must not leave rejected import intents behind or hold SQL transactions across asynchronous work.

**Verdict:** sound. **Confidence:** high.

**Owner:** [assets.ts](../../../packages/core/src/assets.ts).

### Require explicit track edits and report the net batch change

**When:** Origin in `9b839582`; prior ledger location 163–181.

An agent adds tracks, gives them local labels and places selected streams in one batch. Removing an occupied track refuses until its clips are addressed; removing an absent track is harmless. Ordered receipts describe intermediate changes, while the final changed flag compares the starting and resulting documents.

**Gap:** Track setup, no-op meaning and receipts were unspecified.

**Reach:** Adding and then removing the same empty track is a net no-op without hiding its ordered expansion.

**Verdict:** sound. **Confidence:** high.

**Owner:** [edits.ts](../../../packages/composition/src/edits.ts).

### Allocate reproducible local identities and split labels

**When:** Origin in `9b839582`; prior ledger location 163–198.

A batch splits linked video and audio, then addresses each right-hand child by a local label. Each label names the original occurrence that actually split. A member outside the cut cannot borrow a neighboring child; the batch refuses. The stable transaction namespace plus entity kind and ordinal supplies created IDs.

**Gap:** Multiple split children needed inspectable labels and replay-stable allocation.

**Reach:** Callers compose atomic edits without predicting IDs; later retries preserve the same identities.

**Verdict:** sound. **Confidence:** high.

**Owner:** [edits.ts](../../../packages/composition/src/edits.ts).

### Separate immutable metadata from growing origin history

**When:** Origin in `9b839582`; prior ledger location 198–212.

The same file bytes are admitted from many paths. They remain one asset; origin inspection is paged separately from compact asset summaries and full immutable stream metadata. Provenance pagination uses the existing lexical key, so a newly inserted earlier origin appears on a refreshed traversal.

**Gap:** Metadata inspection did not define response and provenance pagination boundaries.

**Reach:** Growing import history cannot inflate every ordinary asset read.

**Verdict:** sound. **Confidence:** high.

**Owner:** [assets.ts](../../../packages/core/src/assets.ts).

### Trim only the addressed end windows

**When:** Origin in `9b839582`; prior ledger location 254–272.

A one-second video is trimmed to its middle and linked audio extends farther than the video. The trim removes those same end windows from the linked audio, leaving its unrelated extra tail. Removing that tail requires another explicit edit.

**Gap:** Linked trim did not specify whether it redefined the entire synchronization group envelope.

**Reach:** A local trim cannot silently shorten content outside its addressed occurrence.

**Verdict:** sound. **Confidence:** high.

**Owner:** [edits.ts](../../../packages/composition/src/edits.ts).

### Ripple collapses only explicitly authorized windows

**When:** Origin in `9b839582`; prior ledger location 273–289.

An agent closes a half-second gap on named tracks. A different unselected clip crossing that window is a refusal, not permission to silently trim it. Fixed overlays stay fixed and their affected anchors are reported; attached overlays follow their root once.

**Gap:** Empty-time ripple and unaddressed crossing content were unspecified.

**Reach:** Future conveniences must name the extra affected content and ripple scope.

**Verdict:** sound. **Confidence:** high.

**Owner:** [edits.ts](../../../packages/composition/src/edits.ts).

### Reanchor without changing the resolved interval

**When:** Origin in `9b839582`; prior ledger location 311–322.

A caller changes which clip a title follows. Reanchor accepts an attachment only when it resolves to the title’s existing exact interval; move or retime performs a deliberate timing change separately. Detach freezes that interval including fractions.

**Gap:** Attachment mutation did not specify whether timing could change implicitly.

**Reach:** Dependencies and timing have separate explicit edit meanings, composable in one batch.

**Verdict:** sound. **Confidence:** high.

**Owner:** [edits.ts](../../../packages/composition/src/edits.ts).

### Copies preserve only dependencies inside the copied set

**When:** Origin in `9b839582`; prior ledger location 344–357.

A caller copies an overlay alone to a later point. The new occurrence becomes independent at that destination rather than staying trapped in its old parent. Copying the parent too preserves the relationship between their new copies. Linked copying is explicit.

**Gap:** External parents and copied attachment dependencies were unspecified.

**Reach:** Copies are usable at the requested destination without altering originals; the caller may reanchor afterward.

**Verdict:** sound. **Confidence:** high.

**Owner:** [edits.ts](../../../packages/composition/src/edits.ts).

### Insert opens time and reuses ordinary placement

**When:** Origin in `9b839582`; prior ledger location 369–380.

An agent inserts a two-source interlude. One operation opens a named duration on explicit ripple tracks, then ordinary place operations insert its streams in the same transaction. An invalid placement rolls back the opening too. A trailing empty gap alone does not extend project duration.

**Gap:** Insertion did not prescribe whether it carried a second placement schema.

**Reach:** Video, audio and layered inserts use one placement owner and one atomic commit.

**Verdict:** sound. **Confidence:** high.

**Owner:** [edits.ts](../../../packages/composition/src/edits.ts).

### Replacement keeps occurrence identity and changes source authority

**When:** Origin in `9b839582`; prior ledger location 416–428;815–836.

An agent replaces narration on one occurrence. The clip ID and chosen timing remain addressable, but an actual changed media binding or selection removes descendants attached to the old content. The agent can detach a title first. Keeping processing is distinct from keeping old source-dependent attachments.

**Gap:** Replacement identity and old dependency consequences were unspecified.

**Reach:** Revision pinning separates evidence about old and new media without allocating a replacement occurrence ID.

**Verdict:** sound. **Confidence:** high.

**Owner:** [edits.ts](../../../packages/composition/src/edits.ts).

### Replacing text constructs a media clip instead of inheriting text provenance

**When:** Origin in `1b6aa64f`; prior ledger location current whole-spec caption-to-media replacement.

A caller replaces a seeded caption with a still or video. The replacement keeps common occurrence fields and the caller’s new binding, but retires the caption’s transcript seed and text source. A pitch policy survives only when compatible with the resulting audio kind; a video never inherits an audio-only pitch field.

**Gap:** Cross-kind replacement exposed fields meaningful only to the retired source kind.

**Reach:** Future clip variants must define their own fields instead of spreading obsolete source metadata into another kind.

**Verdict:** sound. **Confidence:** high.

**Owner:** [replace.ts](../../../packages/composition/src/replace.ts).

### Ripple replacement adopts natural supplied duration

**When:** Origin in `9b839582`; prior ledger location 429–439.

Two seconds of narration are replaced by a one-second selected source using ripple fit. That audio occurrence becomes one second and named later roots shift, while linked video remains unchanged and the timing link splits. A timeless image has no natural duration to borrow.

**Gap:** Ripple fit did not define its duration basis or linked-video consequence.

**Reach:** Ripple remains distinct from stretch-to-target and does not silently retime another plane.

**Verdict:** sound. **Confidence:** high.

**Owner:** [edits.ts](../../../packages/composition/src/edits.ts).

### Authored silence is an asset-free occurrence

**When:** Origin in `9b839582`; prior ledger location 440–452.

A caller wants a final three-second silence that contributes to project duration. It is an ordinary audio clip with identity and placement but no pretend WAV, stream, source clock or pitch policy. Source mapping omits it; composition inspection shows its interval.

**Gap:** The original media-only clip model had no durable shape for explicit silence.

**Reach:** Normal edits and normalized attachments can address silence without inventing captured samples.

**Verdict:** sound. **Confidence:** high.

**Owner:** [README.md](../../../packages/composition/README.md).

### Audio routing ties use stable identity

**When:** Origin in `9b839582`; prior ledger location 467–479.

Two audio siblings have equal order. Kind and ID break ties consistently even if stored arrays are rearranged; this affects evidence ordering rather than voice priority or gain. Visual siblings instead require unique orders.

**Gap:** Canonical audio ordering did not specify tie keys.

**Reach:** Routing, evidence rank and compilation share deterministic ordering without relying on storage order.

**Verdict:** sound. **Confidence:** high.

**Owner:** [routing.ts](../../../packages/composition/src/routing.ts).

### Processing steps have project-wide identity and copy lineage

**When:** Origin in `9b839582`; prior ledger location 480–493.

A clip splits with an existing processor. The first retained piece keeps its step ID; added pieces receive distinct IDs and receipts map old to new. An agent edits one fragment without silently changing its neighbor.

**Gap:** Step uniqueness and lineage representation were unspecified.

**Reach:** Prepared dependencies and later get/set operations identify a single owned instance.

**Verdict:** sound. **Confidence:** high.

**Owner:** [processing.ts](../../../packages/composition/src/processing.ts).

### Gain is a finite linear multiplier without automatic limiting

**When:** Origin in `9b839582`; prior ledger location 494–505;2288–2306.

An agent submits gain zero to silence a track or gain above one to amplify it. The authored multiplier is finite and nonnegative, with no hidden upper clamp; execution preserves explicit stack order and inspection reports clipping. Authoring support alone does not prove a native executor exists.

**Gap:** Gain representation and authoring-versus-execution capability were unspecified.

**Reach:** Decibel conveniences must convert at the shared boundary; no automatic normalization follows.

**Verdict:** sound. **Confidence:** high.

**Owner:** [processing.ts](../../../packages/composition/src/processing.ts).

### Mutations share one request namespace per project

**When:** Origin in `9b839582`; prior ledger location 506–520.

An edit request commits but the caller loses the response. Repeating its request ID replays its stored result; reusing that ID for undo conflicts. Canonical object-key ordering permits equivalent JSON objects, while operation/list order remains meaningful. Create requests have their own catalog-wide namespace.

**Gap:** Replay identity across mutation names was unspecified.

**Reach:** CLI and MCP share identities and cannot accidentally reinterpret an edit as another mutation.

**Verdict:** sound. **Confidence:** high.

**Owner:** [projects.ts](../../../packages/core/src/projects.ts).

### Every retained revision owns its media dependencies

**When:** Origin in `9b839582`; prior ledger location 521–530;585–603.

A caller removes a clip from today’s edit and then undoes. Earlier revisions still hold the asset and evidence resources they require. Project deletion retires those references through the existing lifecycle; deleting the project does not delete independently admitted originals.

**Gap:** History retention did not choose a reference owner.

**Reach:** Undo, old output and package closure follow immutable revision roots instead of reconstructing past use.

**Verdict:** sound. **Confidence:** high.

**Owner:** [projects.ts](../../../packages/core/src/projects.ts).

### Build disposable indexes once for an immutable revision

**When:** Origin in `9b839582`; prior ledger location 531–553;3210–3218;4305–4325.

Several previews inspect the same revision. A compiler owns one interval index and source support intersection for that frozen revision; bounded evidence context reuse avoids parsing it for every page. A page-local projection cache dies after the page and no mutable old graph becomes authority.

**Gap:** The plan did not prescribe index lifetime.

**Reach:** Query cost improves without another persistent cache or invalidation registry.

**Verdict:** sound. **Confidence:** high.

**Owner:** [project-evidence.ts](../../../packages/core/src/project-evidence.ts).

### Prune only branches that cannot contribute

**When:** Origin in `9b839582`; prior ledger location 543–553.

A short preview omits unrelated clips and their empty processing branches while keeping contributing ancestors through output. Current processors cannot generate independent signal from an empty branch. A later signal generator or tail-producing effect must explicitly extend this planning rule.

**Gap:** Window planning did not specify safe graph pruning.

**Reach:** New processor admission must account for tails or source-free output rather than inherit an invalid optimization.

**Verdict:** sound. **Confidence:** high.

**Owner:** [processing-plan.ts](../../../packages/composition/src/processing-plan.ts).

### Keep the full source mapping beside each bounded output window

**When:** Origin in `9b839582`; prior ledger location 535–542;554–574.

A preview selects the latter half of a retimed clip. Its worker records still include the original selected source interval and placement, then restrict output to the requested samples. Restarting the mapping at the preview boundary would change stretch phase and gain timing.

**Gap:** Phase preservation did not prescribe worker record shape.

**Reach:** Preparation and direct consumers share original mapping rather than treating windows as newly authored clips.

**Verdict:** sound. **Confidence:** high.

**Owner:** [compiled-records.ts](../../../packages/composition/src/compiled-records.ts).

### Dry means before only the named target stack

**When:** Origin in `9b839582`; prior ledger location 554–574.

An agent asks for a dry group tap. Its child tracks are still processed, but the group’s own steps and all parent stacks are excluded. An after-step tap includes that named step but not later steps. Raw immutable source inspection is a different request.

**Gap:** Tap names needed exact stack boundaries.

**Reach:** All audio/picture consumers expose the same target meaning.

**Verdict:** sound. **Confidence:** high.

**Owner:** [processing-plan.ts](../../../packages/composition/src/processing-plan.ts).

### Deleted projects cannot replay availability

**When:** Origin in `9b839582`; prior ledger location 585–603.

A caller retries an old successful edit after deleting its project. The project returns NOT_FOUND before consulting the edit receipt. Retrying creation can describe the historical creation but never resurrects its rows. A live project still checks replay before stale-head refusal.

**Gap:** Replay versus retirement precedence was unspecified.

**Reach:** Receipts cannot imply usable deleted work, while ordinary lost-reply recovery stays intact.

**Verdict:** sound. **Confidence:** high.

**Owner:** [projects.ts](../../../packages/core/src/projects.ts).

### Retirement remains retryable while a reader holds bytes

**When:** Origin in `9b839582`; prior ledger location 662–673;733–764.

A project is deleted while an existing preview read holds a cache lease. New reads and tokens are fenced immediately; that read drains and references remain until actual removal succeeds. Explicit retry or startup recovery completes retirement without a polling janitor.

**Gap:** Busy-read deletion semantics were unspecified.

**Reach:** Output delivery, cache and revision retirement share the same ownership coordinator.

**Verdict:** sound. **Confidence:** high.

**Owner:** [project-deletion.ts](../../../apps/service/src/project-deletion.ts).

### Preview preserves the already visible frame

**When:** Origin in `9b839582`; prior ledger location 604–627;1812–1826;4071–4094.

A window starts between project frame instants after the sampled clip has ended. Its first picture is still the prior globally sampled picture; only that picture’s displayed interval is clipped. The compiler admits the dependency needed for that sample rather than selecting only clips whose starts fall in the window.

**Gap:** The first bounded compiler rule confused sample time with displayed interval.

**Reach:** Full movies, partial previews, demanded frames and index coverage retain one frame phase.

**Verdict:** sound. **Confidence:** high.

**Owner:** [compiler.ts](../../../packages/composition/src/compiler.ts).

### Missing parent support retains its distinct reason

**When:** Origin in `9b839582`; prior ledger location 604–627;1873–1893.

A child file contains a usable picture but its attached parent was not acquired. Native validates the child’s physical selection then suppresses its contribution, leaving background or other layers. The receipt says ancestor-unavailable; an empty edit in the child cannot repair the missing parent.

**Gap:** Availability precedence and executable handling needed definition.

**Reach:** Evidence never hides the dependency that prevented a layer from contributing.

**Verdict:** sound. **Confidence:** high.

**Owner:** [CompositionPictureExecutor.swift](../../../helpers/mac/Sources/ScreenRecorderFrames/CompositionPictureExecutor.swift).

### Disposable derivatives carry typed owner identities

**When:** Origin in `9b839582`; prior ledger location 628–641.

A source asset and project have identical ID text. Cache reservation, publication, reading and purge include owner kind, so one cannot retire the other’s file. The job/cache infrastructure remains shared instead of adding domain-specific lease stores.

**Gap:** Cache generalization needed explicit ownership independent of byte identity.

**Reach:** Current source/project/capture consumers retain isolated lifetime without a second cache.

**Verdict:** sound. **Confidence:** high.

**Owner:** [cache.ts](../../../packages/core/src/cache.ts).

### Resampling context comes only from current retained media

**When:** Origin in `9b839582`; prior ledger location 642–661.

A pure split leaves the selected continuous source run intact, so both children preserve filter phase. Removing actual material shrinks the run, preventing excluded neighboring samples from entering the filter. Exact source bounds and absolute output bounds travel with the compiled context; post-resampling gain does not split it.

**Gap:** Fixed whole-asset margins leaked excluded samples while naive split resets changed output.

**Reach:** One derived context owner governs cut isolation without authored continuity groups.

**Verdict:** sound. **Confidence:** high.

**Owner:** [audio-context.ts](../../../packages/composition/src/audio-context.ts).

### One attempt owns child workers and private staging

**When:** Origin in `9b839582`; prior ledger location 674–702;1079–1100;1148–1177.

Audio and video consumers use the locked render attempt for private files, cancellation and child lifetime. A child killed outright cannot clean its files; the existing attempt/root ownership handles recovery after it exits. No per-operation janitor interprets private names.

**Gap:** Shared rendering needed an explicit lifetime seam independent of edit interpretation.

**Reach:** Every native consumer must inherit the actual file authority and drain its child before cleanup.

**Verdict:** sound. **Confidence:** high.

**Owner:** [project-render.ts](../../../apps/service/src/project-render.ts).

### Stream compiled frames rather than whole native schedules

**When:** Origin in `9b839582`; prior ledger location 685–702.

A long project sends sealed picture records to the worker one at a time. Native executes compiled numeric instructions instead of interpreting editing commands or retaining every output frame. Current codec/color capabilities govern admission and unsupported declared profiles refuse.

**Gap:** The worker-binding transport and first executable profile needed definition.

**Reach:** Future profiles retain identity and fidelity requirements without creating a second editor.

**Verdict:** sound. **Confidence:** high.

**Owner:** [CompositionVideoRenderer.swift](../../../helpers/mac/Sources/ScreenRecorderFrames/CompositionVideoRenderer.swift).

### PCM blocks are the audio assembly boundary

**When:** Origin in `9b839582`; prior ledger location 703–711;7697–7706.

Project mixing exposes bounded PCM blocks with format and positions; the movie mux remains the H.264-copy/AAC clock owner and WAV uses the same samples. This boundary carries no recording roles or editorial plan. Authored summation belongs to composition, selected-source reading to its source owner.

**Gap:** Independent producers needed a shared consumption seam.

**Reach:** Audio and movie outputs cannot acquire separate mixers merely because their containers differ.

**Verdict:** sound. **Confidence:** high.

**Owner:** [MovieMux.swift](../../../helpers/mac/Sources/ScreenRecorderWire/MovieMux.swift).

### Only the calculated sample deficit may be synthetic zero

**When:** Origin in `9b839582`; prior ledger location 712–732.

A fractional selection can owe one more output sample than its retained source conversion supplies. After the decoder reaches the declared selection end, only that calculated deficit may be zero-filled. Actual truncation still fails and excluded real audio never fills the tail.

**Gap:** Discrete source/output endpoint clocks needed an explicit bounded deficit policy.

**Reach:** Exact output count is preserved without hidden neighboring audio or arbitrary padding.

**Verdict:** sound. **Confidence:** high.

**Owner:** [AudioSource.swift](../../../helpers/mac/Sources/ScreenRecorderAudio/AudioSource.swift).

### Reuse unchanged rendered pixels only within the attempt

**When:** Origin in `9b839582`; prior ledger location 712–732;1914–1942.

A held image repeats across many frames. Native keeps one immutable rendered result keyed by actual source sample, reader, background and relevant processing, while each emitted frame retains its own time. New image-changing processing must affect reuse identity or disable it.

**Gap:** Rendering bounds did not prescribe residency and reuse.

**Reach:** The optimization adds bounded temporary buffers, not persistent picture authority.

**Verdict:** sound. **Confidence:** high.

**Owner:** [CompositionPictureExecutor.swift](../../../helpers/mac/Sources/ScreenRecorderFrames/CompositionPictureExecutor.swift).

### Pin resolved requests before asynchronous work

**When:** Origin in `9b839582`; prior ledger location 733–764;4029–4070.

An agent asks for current preview, then edits while native metadata preflight runs. The old revision, range, tap and rendition remain the admitted request; new work is committed only after rechecking owner availability. There is no SQL transaction held across the worker await.

**Gap:** Asynchronous validation needed immutable intent and transaction placement.

**Reach:** Audio, preview, preparation and export cannot follow a moving head halfway through admission.

**Verdict:** sound. **Confidence:** high.

**Owner:** [project-preview.ts](../../../packages/core/src/project-preview.ts).

### Retained published bytes do not require the old executor

**When:** Origin in `9b839582`; prior ledger location 765–779;1943–1972;3326–3347.

An export has already pinned complete cached or prepared output. It may publish those bytes when the renderer/model is unavailable. Regeneration after loss instead requires its original implementation and explicit permitted retry; unrelated decode failures do not gain retry authority.

**Gap:** Deployment availability and retained-output recovery needed separate ownership.

**Reach:** Saved outputs remain independent of live execution without silent recipe substitution.

**Verdict:** sound. **Confidence:** high.

**Owner:** [prepared-audio.ts](../../../packages/core/src/prepared-audio.ts).

### Project export pins one project and one physical destination

**When:** Origin in `9b839582`; prior ledger location 765–796;5687–5728.

The app chooses a folder through an alias. Before the first export request it resolves the physical folder, pins project revision and destination in the existing intent, and resends those same values. Changing the alias afterward cannot redirect the export; discovery cursors bind the current project filter.

**Gap:** Chooser aliases, intent replay and discovery filtering needed one meaning.

**Reach:** Current export is project-only; recording source lifetime never becomes a second editing/export owner.

**Verdict:** sound. **Confidence:** high.

**Owner:** [exports.ts](../../../apps/service/src/exports.ts).

### Close admission before draining service work

**When:** Origin in `9b839582`; prior ledger location 781–796.

Shutdown first stops new exports and signals owned cancellation, then waits for accepted requests and workers before closing storage. Waiting before cancellation could leave the very work being awaited without the signal needed to end it.

**Gap:** Shutdown ordering was unspecified.

**Reach:** Existing owners retain one drain sequence instead of a second timeout or shutdown manager.

**Verdict:** sound. **Confidence:** high.

**Owner:** [project-service.ts](../../../apps/service/src/project-service.ts).

### A word fragment belongs to one occurrence

**When:** Origin in `9b839582`; prior ledger location 797–814.

A source word is split through two edited clips. Each occurrence returns its own exact partial fragment; the reader never fuses them into an invented whole word. A wholly removed range returns no word, while unavailable support remains separately inspectable.

**Gap:** Empty/partial word projection shape was unspecified.

**Reach:** Search cannot upgrade partial speech and source absence is not proof of silence.

**Verdict:** sound. **Confidence:** high.

**Owner:** [source-projection.ts](../../../packages/composition/src/source-projection.ts).

### Capture contexts constrain bytes but do not guarantee them

**When:** Origin in `9b839582`; prior ledger location 815–836.

An acquisition receipt records support beyond a physical file endpoint. Validation retains the raw context but uses only the intersection for the selected stream. A context may describe unused siblings without forcing their assets into every project.

**Gap:** Context validation scope and broader journal support were unspecified.

**Reach:** Evidence preserves provenance while rendering reads only physical available media.

**Verdict:** sound. **Confidence:** high.

**Owner:** [source-projection.ts](../../../packages/composition/src/source-projection.ts).

### Imported streams are not recording roles

**When:** Origin in `9b839582`; prior ledger location 837–857;7697–7706.

A selected imported audio stream returns the same neutral PCM facts as captured audio; only real capture receipts add microphone/system provenance. A file with two audio streams requires explicit stream selection, and omission is an invalid request rather than choosing the first.

**Gap:** Shared source-report shape and omission error category were unspecified.

**Reach:** One decoder can serve imported/captured evidence without inventing narration.

**Verdict:** sound. **Confidence:** high.

**Owner:** [AudioPCMStream.swift](../../../helpers/mac/Sources/ScreenRecorderAudio/AudioPCMStream.swift).

### Failed multi-source admission preserves valid admitted assets

**When:** Origin in `9b839582`; prior ledger location 858–889.

Video admission can succeed before another stream makes acquisition fail. The incomplete context stays unavailable and releases its references, but valid immutable assets remain because another project may already use them.

**Gap:** Rollback visibility for successful member imports was unspecified.

**Reach:** Asset lifetime remains with the actual asset owner rather than destructive context rollback.

**Verdict:** sound. **Confidence:** high.

**Owner:** [acquisitions.ts](../../../packages/core/src/acquisitions.ts).

### Recover abandoned preparation before releasing the queue

**When:** Origin in `9b839582`; prior ledger location 858–889;3739–3754.

Startup holds exclusive service ownership, resolves abandoned acquisition files/generations/references, constructs every execution owner, and only then starts the shared queue. Reversing this could erase the files a resumed job just created or execute before its handler exists.

**Gap:** Recovery and construction ordering were unspecified.

**Reach:** New owners join one assembly barrier rather than invent per-feature retries.

**Verdict:** sound. **Confidence:** high.

**Owner:** [project-service.ts](../../../apps/service/src/project-service.ts).

### Support digests supplement explicit source identity

**When:** Origin in `9b839582`; prior ledger location 890–908.

Two contexts retain the same samples but have different capture provenance. Preparation keys preserve asset, stream and optional acquisition alongside a compact support digest. The digest never replaces those selectors.

**Gap:** Compact input shape and source identity needed separation.

**Reach:** Equal support cannot silently swap origins or selected streams.

**Verdict:** sound. **Confidence:** high.

**Owner:** [source-selection.ts](../../../packages/core/src/source-selection.ts).

### Source phrase matching stops at inference-segment boundaries

**When:** Origin in `9b839582`; prior ledger location 909–933.

A capture gap leaves two recognized words adjacent in stored order. Source search does not match them as one continuous phrase because their retained segment identity differs. Project phrase matching separately uses authored continuity on each track.

**Gap:** Acquisition-gap search needed an explicit boundary representation.

**Reach:** Source token adjacency and edited playback adjacency keep their distinct meanings.

**Verdict:** sound. **Confidence:** high.

**Owner:** [transcript.ts](../../../packages/core/src/transcript.ts).

### Attach job references in its admission transaction

**When:** Origin in `9b839582`; prior ledger location 909–933.

Preparing a source stores its actual assigned job ID and asset/acquisition references together. If a reference write fails, queue admission rolls back too. No separate guessed dependency identity is used.

**Gap:** Preparation references needed the real queue identity during atomic admission.

**Reach:** Cancellation, retirement and retry follow one job’s actual dependencies.

**Verdict:** sound. **Confidence:** high.

**Owner:** [jobs.ts](../../../packages/core/src/jobs.ts).

### The final canceled model consumer waits for cleanup

**When:** Origin in `9b839582`; prior ledger location 909–933.

Two callers share one model preparation. One cancel returns promptly if the other still needs it. Canceling the last caller waits for temporary-file cleanup before its promise settles, so storage ownership cannot be released while the downloader still writes.

**Gap:** Shared cancellation settlement timing was unspecified.

**Reach:** Service shutdown can trust awaiting the model owner without another cleanup tracker.

**Verdict:** sound. **Confidence:** high.

**Owner:** [models.ts](../../../packages/core/src/models.ts).

### Word ordering is a portable admission invariant

**When:** Origin in `9b839582`; prior ledger location 934–954.

A late word query seeks the immediately preceding row and selected window because stored word rows are nonoverlapping. Package admission enforces that invariant across page boundaries too, rather than making readers scan backward by the longest word anywhere.

**Gap:** Bounded seeking needed a general data invariant.

**Reach:** Imported evidence and local ingestion permit the same indexed reads.

**Verdict:** sound. **Confidence:** high.

**Owner:** [transcript.ts](../../../packages/core/src/transcript.ts).

### Select occurrence envelopes before available fragments

**When:** Origin in `9b839582`; prior ledger location 934–954.

A query falls entirely inside an acquisition hole. It still names the clip and context with empty available fragments instead of dropping the occurrence. That shows why evidence is missing and prevents phrases spanning the hole.

**Gap:** Envelope selection and fragment filtering were ambiguous.

**Reach:** Canonical mapping supplies absence reasons without each query rebuilding timeline arithmetic.

**Verdict:** sound. **Confidence:** high.

**Owner:** [source-projection.ts](../../../packages/composition/src/source-projection.ts).

### A project retry does not retranscribe every source

**When:** Origin in `9b839582`; prior ledger location 998–1016;1518–1533.

A failed project query names several sources with different problems. Explicit project retry rebuilds its own manifest; source retry uses the returned source selection after diagnosis. Ordinary reads leave terminal failures alone.

**Gap:** The plan did not specify retry fanout.

**Reach:** Expensive inference and failed dependency recovery remain explicit requests.

**Verdict:** sound. **Confidence:** high.

**Owner:** [project-evidence.ts](../../../packages/core/src/project-evidence.ts).

### Source windows and project windows keep their own sample policies

**When:** Origin in `9b839582`; prior ledger location 955–1016;7637–7646;7697–7706.

A caller requests a later source excerpt and compares it with the same selected interval of the full source. Source extraction preserves its physical origin and absolute source clock. Project mixing instead follows authored placement, and transcription spans have cumulative source timing/join conditioning. None is a fake one-span recording edit.

**Gap:** Source producer integration could have reused a semantically different recording clock.

**Reach:** Consumers share decoding while retaining their actual window/placement contracts.

**Verdict:** sound. **Confidence:** high.

**Owner:** [AudioPCMStream.swift](../../../helpers/mac/Sources/ScreenRecorderAudio/AudioPCMStream.swift).

### Refuse unknown rates and layouts instead of silently remapping

**When:** Origin in `9b839582`; prior ledger location 955–979;2605–2621.

An admitted source may report a fractional rate or unusual channel layout. Original metadata remains importable, but current execution validates its finite integral supported rate and requested layout before decoding. Unsupported raw layouts refuse; project stereo mapping remains its explicit separate contract.

**Gap:** Admission and executable-domain boundaries were previously conflated.

**Reach:** A later rate/layout extension requires its own execution identity and sample proof rather than rounding.

**Verdict:** sound. **Confidence:** high.

**Owner:** [AudioSource.swift](../../../helpers/mac/Sources/ScreenRecorderAudio/AudioSource.swift).

### Large audio is an artifact rather than a giant inline message

**When:** Origin in `9b839582`; prior ledger location 1038–1052.

A whole source WAV can be a gigabyte. CLI streams it to the selected file and MCP returns the existing renewable delivery token once it exceeds inline bounds. Small excerpts can remain inline; bounded artifact reads carry the full audio without allocating a giant message.

**Gap:** Full delivery did not prescribe MCP representation.

**Reach:** Audio uses the same read/renew/close transport as other media rather than another download protocol.

**Verdict:** sound. **Confidence:** high.

**Owner:** [operations.ts](../../../packages/protocol/src/operations.ts).

### Phrase ordering follows the first contributing word

**When:** Origin in `9b839582`; prior ledger location 1053–1078.

Two tracks speak at different rates. The merger orders complete matches by each phrase’s first word, not when its last word becomes available. Each track is searched independently and checkpoints can advance with empty pages while an earlier lane is scanned.

**Gap:** Stable project ordering did not choose a phrase merge mechanism.

**Reach:** Simultaneous tracks cannot interleave into invented phrases or reorder by finish time.

**Verdict:** sound. **Confidence:** high.

**Owner:** [project-transcript.ts](../../../packages/core/src/project-transcript.ts).

### Inspection clipping does not change editorial partiality

**When:** Origin in `9b839582`; prior ledger location 1053–1078.

A caller inspects a narrow time inside a retained whole word. The result keeps that word’s complete editorial fragments so the caller can make a later cut. A genuinely trimmed word stays partial; synthetic support gaps describe the inspected window because they have no original word row.

**Gap:** Display clipping and edit-induced partiality needed distinct meanings.

**Reach:** Query windows cannot erase recoverable boundaries or imply an editorial cut.

**Verdict:** sound. **Confidence:** high.

**Owner:** [project-transcript.ts](../../../packages/core/src/project-transcript.ts).

### Audio and picture admission select their actual media plane

**When:** Origin in `9b839582`; prior ledger location 1079–1115.

A track audio request does not fail because an unrelated picture processor is unavailable. A demanded project still does not need speech stretch readiness. Movie work selects both planes; every path still uses the same compiler/source-binding owner.

**Gap:** Shared planning did not prescribe independent plane selection.

**Reach:** Inspectors do not gain a second mixer or clock merely to avoid unrelated execution requirements.

**Verdict:** sound. **Confidence:** high.

**Owner:** [project-window.ts](../../../packages/core/src/project-window.ts).

### Decoder recovery uses packet-sized context and finite demand

**When:** Origin in `9b839582`; prior ledger location 1116–1147;3582–3593;2700–2710.

A late request can miss samples near a compressed packet. The reader uses bounded packet lookbehind, discards it before conversion, and permits only the established progress-based premature-end retry. The caller supplies the finite actual decode end; adjacent requests consume buffered samples or extend coverage separately from failure recovery.

**Gap:** Seek context and coverage extension were unspecified.

**Reach:** Unknown/oversized metadata refuses and no infinite decode range conceals unbounded read-ahead.

**Verdict:** sound. **Confidence:** high.

**Owner:** [AudioSource.swift](../../../helpers/mac/Sources/ScreenRecorderAudio/AudioSource.swift).

### Source sample addresses survive ambiguous decoder timestamps

**When:** Origin in `9b839582`; prior ledger location 2700–2710;assets/08-native-sample-address/choices.md.

After a seek, the same rounded timestamp may describe distinct returned sample payloads. The reader retains each physical run’s sample origin and counts samples, seeking strictly inside the already selected native sample cell when needed. It does not fit an offset from the failing example.

**Gap:** Timestamps alone could not identify sample payload.

**Reach:** Selected sample identity remains exact through source masks and fractional placement.

**Verdict:** sound. **Confidence:** high.

**Owner:** [AudioSource.swift](../../../helpers/mac/Sources/ScreenRecorderAudio/AudioSource.swift).

### New execution identity does not rewrite portable evidence

**When:** Origin in `9b839582`; prior ledger location 1116–1177;3053–3063;3507–3515;3755–3767;6453–6473.

A decoder, processor or supported work domain changes. New requests include the changed execution recipe so old ready jobs/refusals cannot answer them. Retained transcripts, audio and pictures keep their recorded generation/model identity and format; saved evidence is not relabeled as current output.

**Gap:** Cache invalidation and portable-format lifetime needed independent ownership.

**Reach:** Implementation releases cannot silently recompute or invalidate historical evidence.

**Verdict:** sound. **Confidence:** high.

**Owner:** [prepared-audio.ts](../../../packages/core/src/prepared-audio.ts).

### Raw source pictures have source receipts

**When:** Origin in `9b839582`; prior ledger location 1178–1192.

An agent selects the second stream of an asset at a source time. The result identifies the actual physical sample and source support, not a made-up project/revision/canvas. Source absence and acquisition exclusion are distinct responses rather than synthetic black source PNGs.

**Gap:** Raw inspection receipt and gap shape were unspecified.

**Reach:** Source evidence remains independent of authored composition while sharing native orientation/publication.

**Verdict:** sound. **Confidence:** high.

**Owner:** [frame-inspection.ts](../../../packages/core/src/frame-inspection.ts).

### Picture receipts preserve request and exact physical clocks

**When:** Origin in `9b839582`; prior ledger location 1116–1177;1812–1826; 1104–1115;1812–1826.

A project frame samples inside one source picture. Its receipt retains requested exact source time and the native value/timescale/origin alongside a rounded convenience label. The public project receipt describes the full displayed output interval; native admission still validates the demanded window first. A point request at 75,001 microseconds in a twenty-fps project internally asks for a one-microsecond window and samples the picture already visible from 50,000. Its returned receipt reports the full displayed frame interval separately from that point request; the source physical sample is another clock.

**Gap:** Receipt projection did not distinguish physical sample, query and display clocks. Point-inspection representation had not prescribed how to reuse movie scheduling.

**Reach:** A rounded label cannot become a false exact boundary or alternate frame selector. Direct pictures never add a second nearest-frame policy.

**Verdict:** sound. **Confidence:** high.

**Owner:** [frame-inspection.ts](../../../packages/core/src/frame-inspection.ts).

### Deliver image size after composing the actual canvas

**When:** Origin in `9b839582`; prior ledger location 1116–1177;2167–2174.

A caller requests a small PNG of a large authored output. Native orients and composes at the movie canvas first, then scales the completed picture through the existing PNG delivery path. Scaling inputs first or applying source-edge sampling a second time would create another framing route.

**Gap:** Picture sizing versus source/composition order was unspecified.

**Reach:** Direct pictures and movies use the same layout while delivery dimensions remain explicit.

**Verdict:** sound. **Confidence:** high.

**Owner:** [CompositionFrameRenderer.swift](../../../helpers/mac/Sources/ScreenRecorderFrames/CompositionFrameRenderer.swift).

### Numerical measurements survive eviction of disposable audio

**When:** Origin in `9b839582`; prior ledger location 1211–1234;1360–1391.

A waveform already records a completed audio recipe. Evicting the WAV does not invalidate those measurements or their plotted image. If rebuilding needs missing audio, explicit retry follows the existing dependency chain; an ordinary read does not restart canceled work.

**Gap:** Multistage measurement/cache lifetime was unspecified.

**Reach:** Useful evidence remains independent of retaining large temporary WAV files indefinitely.

**Verdict:** sound. **Confidence:** high.

**Owner:** [acoustic-inspection.ts](../../../packages/core/src/acoustic-inspection.ts).

### Spectral analysis retains linear power before display contrast

**When:** Origin in `9b839582`; prior ledger location 1290–1325.

A caller inspects hum or a consonant. Numerical spectra preserve per-channel linear density and DC energy with defined Hann/rectangular window normalization. Images then use a labeled fixed decibel scale rather than changing or flooring the measured data.

**Gap:** Normalization/window/display conventions were unspecified.

**Reach:** Measurements remain comparable independently of image contrast.

**Verdict:** sound. **Confidence:** high.

**Owner:** [audio-spectrum.ts](../../../packages/core/src/audio-spectrum.ts).

### Spectral windows use one global grid with explicit missing context

**When:** Origin in `9b839582`; prior ledger location 1290–1307;1360–1391.

A narrow spectrogram view shares identical overlapping columns with the same full audio. Its FFT may require surrounding samples, acquired through the existing selected audio owner and masks; missing context is reported separately from displayed availability.

**Gap:** Edge-window and full/range analysis context semantics were unspecified.

**Reach:** No invented neighboring audio or hidden widened selection becomes acoustic evidence.

**Verdict:** sound. **Confidence:** high.

**Owner:** [audio-spectrum.ts](../../../packages/core/src/audio-spectrum.ts).

### Bound visible labels while retaining full provenance

**When:** Origin in `9b839582`; prior ledger location 1318–1325.

A very long clip identifier cannot fit in a bounded waveform image. The visible label explicitly tells the caller that full text is in the receipt, which retains the complete provenance. Plotting accepts measurements and cannot reopen or remix audio.

**Gap:** Image label overflow and plotting execution owner were unspecified.

**Reach:** Agents can resolve identity without another audio decoder or silent text truncation.

**Verdict:** sound. **Confidence:** high.

**Owner:** [AcousticImage.swift](../../../helpers/mac/Sources/ScreenRecorderFrames/AcousticImage.swift).

### Touching availability declarations do not create edit joins

**When:** Origin in `9b839582`; prior ledger location 1235–1245.

Support from zero to one second and one to two seconds is continuous for selected audio decoding. A one-microsecond gap stays excluded and overlapping declarations refuse. Joining support declarations does not introduce a fade or erase real physical container boundaries.

**Gap:** Adjacent support declaration handling was unspecified.

**Reach:** Availability normalization remains independent of caller-authored cuts.

**Verdict:** sound. **Confidence:** high.

**Owner:** [AudioSource.swift](../../../helpers/mac/Sources/ScreenRecorderAudio/AudioSource.swift).

### Completion facts keep their verified endpoint

**When:** Origin in `9b839582`; prior ledger location 1246–1269;3377–3399.

A selected microphone ends before finalized video. Capture completion stays at the actual verified video endpoint, not an invented earlier failure onset. Damaged/contradictory journal facts remain visible but cannot publish a trusted marker.

**Gap:** The journal fact authorizing interruption time was unspecified.

**Reach:** Failure codes/messages and terminal facts retain provenance independently of source duration.

**Verdict:** sound. **Confidence:** high.

**Owner:** [capture-source-read.ts](../../../packages/core/src/capture-source-read.ts).

### Closing endpoint events belong to the preceding query range

**When:** Origin in `9b839582`; prior ledger location 1246–1269.

A completion at two seconds appears in a one-to-two-second query and is not repeated by a query starting at two. Ordinary observations remain start-inclusive/end-exclusive. At a clip boundary, prior endpoint and next opening merge by the existing exact ordering.

**Gap:** Completion endpoint query/pagination ownership was unspecified.

**Reach:** Final markers neither disappear nor recur across adjacent pages.

**Verdict:** sound. **Confidence:** high.

**Owner:** [project-events.ts](../../../packages/core/src/project-events.ts).

### Scene sampling distinguishes observations and physical support

**When:** Origin in `9b839582`; prior ledger location 1270–1289;1392–1410;1496–1517.

Two observed pictures can have a physical hole between them. Stillness resets across that hole even if endpoint pictures match; touching support stays continuous. Scene rows retain exact sample clocks and observation request times rather than inventing an unseen semantic cut.

**Gap:** Chunk overlap and sampled-time versus physical-time meaning were unspecified.

**Reach:** Sparse scenes never certify all unobserved pixels or turn unavailable samples into missing intervals.

**Verdict:** sound. **Confidence:** high.

**Owner:** [source-scenes.ts](../../../packages/core/src/source-scenes.ts).

### Scene continuations count examined samples

**When:** Origin in `9b839582`; prior ledger location 1326–1345.

Several samples share one rounded displayed microsecond. A page considers a bounded number, filters membership with exact time and advances past the last examined ordinal even if it returns no rows. A late cursor seeks directly instead of rescanning earlier chunks.

**Gap:** Bounded range traversal and tied rounded labels needed a continuation rule.

**Reach:** Consumers must follow nonempty cursors on empty pages; exact clocks still determine membership.

**Verdict:** sound. **Confidence:** high.

**Owner:** [source-scene-chunks.ts](../../../packages/core/src/source-scene-chunks.ts).

### Selected-source generations are prepared on demand

**When:** Origin in `9b839582`; prior ledger location 1193–1210;1346–1359.

An agent’s first scene request queues one scan of that stream and acquisition support; later overlapping requests use its retained generation. Merely importing the asset does not automatically start scene analysis. A canceled request stays explicitly retryable; deletion permanently fences and drains its work.

**Gap:** Generation scope and preparation scheduling were unspecified.

**Reach:** One heavy queue and reference graph own current source analysis.

**Verdict:** sound. **Confidence:** high.

**Owner:** [scene-processing.ts](../../../packages/core/src/scene-processing.ts).

### Finished indexes own copied results rather than all inputs forever

**When:** Origin in `9b839582`; prior ledger location 1518–1533;1761–1791;1943–1972.

A queued screenshot index pins its exact earlier scene/history prerequisites. Once it has copied its PNGs and coverage, successful/permanent settlement releases preparation-only references; ordinary source/result dependencies retain their own lifetime. Explicit retry follows failed prerequisites once, while reads never restart them.

**Gap:** Input versus retained-result ownership and retry fanout were unspecified.

**Reach:** One resource-reference owner avoids retaining every intermediate or inventing another queue.

**Verdict:** sound. **Confidence:** high.

**Owner:** [index-processing.ts](../../../packages/core/src/index-processing.ts).

### Known gaps have no retained image reference

**When:** Origin in `9b839582`; prior ledger location 1454–1495;1718–1748.

An index reports a source acquisition hole without pointing at the previous PNG as if it represented that interval. A point with no native picture records that exact observation; a failed decode remains a failure. An all-unavailable source index can finish with no images and explained coverage.

**Gap:** Retained coverage, empty results and failure classification were unspecified.

**Reach:** Completion means truthful evidence is available, not that a representative picture must exist.

**Verdict:** sound. **Confidence:** high.

**Owner:** [source-index.ts](../../../packages/core/src/source-index.ts).

### Cut ties use the arriving occurrence

**When:** Origin in `9b839582`; prior ledger location 1558–1577.

A captured event and editorial cut share project time. The cut sorts with the arriving clip; an exit uses the departing clip, and its ordinal precedes source observations for that same clip. A source-free project can still declare its revision-derived cuts ready.

**Gap:** Stable event ordering and readiness location were unspecified.

**Reach:** Future event kinds cannot reshuffle established source rows or invent source provenance for authored silence.

**Verdict:** sound. **Confidence:** high.

**Owner:** [project-events.ts](../../../packages/core/src/project-events.ts).

### Select each observed scene side toward its own support

**When:** Origin in `9b839582`; prior ledger location 1578–1594;1646–1666.

A source scene changes between two observations but the project uses a coarser frame grid. The old side selects at-or-before its observation and the new side at-or-after, omitting a side outside that occurrence’s support. Shared compiler neighbors select authored boundaries.

**Gap:** Directional rounding and boundary neighbor selection were unspecified.

**Reach:** A new-side explanation cannot silently point at the old sampled picture or neighboring clip.

**Verdict:** sound. **Confidence:** high.

**Owner:** [project-index-selection.ts](../../../packages/core/src/project-index-selection.ts).

### One geometry primitive uses actual native source extents

**When:** Origin in `9b839582`; prior ledger location 1629–1645;2110–2125;assets/15-layer-geometry/choices.md.

A caller positions and rotates a presenter using the same rectangle/angle fields as static geometry. Native orientation supplies actual transformed support; TypeScript does not reinterpret preferred transforms. Odd source/canvas geometry stays valid, with codec restrictions at encoding.

**Gap:** Position representation and orientation-owner boundary were unspecified.

**Reach:** Animation and nested geometry cannot acquire parallel translation or orientation policies.

**Verdict:** sound. **Confidence:** high.

**Owner:** [geometry.ts](../../../packages/composition/src/geometry.ts).

### Source sampling and geometric coverage have separate jobs

**When:** Origin in `9b839582`; prior ledger location 1629–1645;2194–2201;assets/15-layer-geometry/choices.md.

A crop can extend outside a source. Source pixel-center clamping avoids foreign colors and dark fringes; destination coverage establishes alpha. Parent geometry materializes its preceding canvas in the chosen premultiplied linear representation, rather than relying on optimizer-sensitive crop masks.

**Gap:** Native geometric sampling/mask mechanism was unspecified.

**Reach:** One picture executor applies compiled primitives and explicitly accounts for every intermediate surface.

**Verdict:** sound. **Confidence:** high.

**Owner:** [CompositionPictureExecutor.swift](../../../helpers/mac/Sources/ScreenRecorderFrames/CompositionPictureExecutor.swift).

### Public picture receipts expose evidence rather than private draw instructions

**When:** Origin in `9b839582`; prior ledger location 1718–1748.

An agent sees a physical picture’s layers and times, but authored placement is inspected through processing.get. Core first verifies the worker’s complete graph and ordered physical provenance; it then omits renderer-coordinate metadata that could be mistaken for authored geometry.

**Gap:** Public evidence and private native instruction representations were conflated.

**Reach:** Agents cannot infer another edit from an internal lower-left coordinate; repeated layers retain their own provenance.

**Verdict:** sound. **Confidence:** high.

**Owner:** [frame-inspection.ts](../../../packages/core/src/frame-inspection.ts).

### Pointer steps require the actual acquisition-bound clip

**When:** Origin in `9b839582`; prior ledger location 1693–1717;2005–2019;1749–1760.

A group can combine several sources, so a pointer step belongs on the selected acquisition-bound video clip rather than guessing a group member. At each stack position, the overlay reuses the geometric prefix without inheriting earlier opacity, then later steps process the combined result. Disabled steps still carry their actual typed authored metadata through the strict native boundary; bypass does not erase fields needed to decode that stack.

**Gap:** Target ownership and ordered overlay geometry needed definition.

**Reach:** Capability discovery and atomic replacement validation share one source-binding rule.

**Verdict:** sound. **Confidence:** high.

**Owner:** [composition-pointer.ts](../../../packages/core/src/composition-pointer.ts).

### Pointer prerequisite repair yields the heavy lane once

**When:** Origin in `9b839582`; prior ledger location 1943–1972.

An index occupies the heavy lane while its frame children need prepared pointer history. It admits history first and holds cache descriptors. Lost prerequisites release the lane for the existing bounded readmission; repeated loss fails, and ordinary reads/pressure do not create no-progress wakeups.

**Gap:** Nested work and disappearing inputs needed deadlock-free ownership.

**Reach:** Only actual transitions wake waiting parents; no polling retry loop is introduced.

**Verdict:** sound. **Confidence:** high.

**Owner:** [pointer-preparation.ts](../../../packages/core/src/pointer-preparation.ts).

### Still images have no invented source clock

**When:** Origin in `9b839582`; prior ledger location 1847–1872;1894–1942.

A photograph is admitted as one complete PNG/JPEG frame with orientation and alpha. Raw inspection omits time and rejects video-time/acquisition selectors; animation or incomplete decode refuses. Project placement uses an ordinary hold at zero, while compiled receipts identify a timeless image rather than a physical sample at zero.

**Gap:** Image admission/composition needed shapes distinct from sampled video.

**Reach:** Source and project images share sizing/publication without fabricated duration or capture provenance.

**Verdict:** sound. **Confidence:** high.

**Owner:** [StillImageSource.swift](../../../helpers/mac/Sources/ScreenRecorderMedia/StillImageSource.swift).

### Raw image delivery is independent of a referencing project

**When:** Origin in `9b839582`; prior ledger location 1894–1913.

A caller deletes a project that used a photograph. The admitted asset and its separate raw PNG lease remain usable because they are asset-owned, while project-owned outputs are revoked. No absent asset-delete API is invented just for a fixture.

**Gap:** Raw inspection lifetime and test deletion scope were unspecified.

**Reach:** Independent originals do not inherit another project’s retirement.

**Verdict:** sound. **Confidence:** high.

**Owner:** [frame-inspection.ts](../../../packages/core/src/frame-inspection.ts).

### Animation preserves the original function and clock

**When:** Origin in `9b839582`; prior ledger location 2020–2061;2076–2090;2202–2233.

A curved zoom is split halfway. Both children retain original keys and exact evaluation intervals instead of restarting easing from the split value. Numeric programs are compiled from those authoring fields, while native receives resolved visual scalars or shared audio coefficients.

**Gap:** Storage and worker lowering did not choose a restriction representation.

**Reach:** No second native easing evaluator or editable numerical program competes with authored curves.

**Verdict:** sound. **Confidence:** high.

**Owner:** [curve.ts](../../../packages/composition/src/curve.ts).

### Validate complete curve domains without arbitrary clipping

**When:** Origin in `9b839582`; prior ledger location 2037–2061;2076–2090;2150–2166.

An opacity curve can have an easing handle outside zero-to-one while all resulting values remain valid. Validate its actual extrema rather than forbid such handles or clamp invalid alpha. Signed/zero scale stays valid; width/height remain strictly positive and pivot in zero-to-one. A crop can extend beyond its source as static geometry allows. Size extrema use the smallest positive representable bound rather than an arbitrary epsilon that would reject otherwise positive authored values.

**Gap:** Animated physical bounds and overshoot validation were unspecified.

**Reach:** Animation inherits existing static semantics and finite matrix emission checks.

**Verdict:** sound. **Confidence:** high.

**Owner:** [temporal-processing.ts](../../../packages/composition/src/temporal-processing.ts).

### One scalar numerical program owns precision

**When:** Origin in `9b839582`; prior ledger location 2202–2233.

A steep envelope near an endpoint can magnify a tiny timing error. Exact clock lowering remains in the BigInt owner, with a fixed global sample origin and key-sized polynomial program shared with native. The root solver stops only when floating bounds can no longer narrow; authored endpoints bypass search.

**Gap:** Native arithmetic representation and solver termination were unspecified.

**Reach:** No fixed-width rational restriction or duration-sized gain array is introduced.

**Verdict:** sound. **Confidence:** high.

**Owner:** [scalar-program.ts](../../../packages/composition/src/scalar-program.ts).

### Package adoption remaps outer identity and preserves inner identity

**When:** Origin in `9b839582`; prior ledger location 2062–2075;2126–2149.

A caller adopts the same archive twice. Each receives fresh project/revision IDs, while clip, track, processor and acquisition identities retain their within-document meaning. The receipt maps donor revisions; conflicting retained acquisition evidence must match complete metadata and hashes, not silently remap.

**Gap:** Collision and adoption identity scope were unspecified.

**Reach:** Independent project copies share immutable resources without sharing project lifecycle.

**Verdict:** sound. **Confidence:** high.

**Owner:** [projects.ts](../../../packages/core/src/projects.ts).

### Portable publication is one atomic project transaction

**When:** Origin in `9b839582`; prior ledger location 2062–2075;2091–2150;2175–2193;2234–2255;2392–2414.

A package copies/hashes media and stages normalized scene/transcript/index rows before its adoption transaction. The transaction publishes all assets, references and retained history together; failed work stays invisible and existing owner recovery removes abandoned staging. A result returns durable IDs instead of a potentially oversized document.

**Gap:** Staging/publication sequencing and result shape were unspecified.

**Reach:** No partly imported project or fabricated completed worker can look ready.

**Verdict:** sound. **Confidence:** high.

**Owner:** [project-packages.ts](../../../apps/service/src/project-packages.ts).

### Historical export stops at the selected moment

**When:** Origin in `9b839582`; prior ledger location 2062–2075;2091–2109;2497–2509.

A project has revisions A, B and C, and the caller exports B. The recipient opens B with history and the actual undo state through B; C stays only in the donor. Undo/restore append revisions, so history alone cannot replace the active undo stack.

**Gap:** Historical head selection and the later-history branch meaning were unspecified.

**Reach:** Adopted projects continue the ordinary sequence without an invented branching model.

**Verdict:** sound. **Confidence:** high.

**Owner:** [projects.ts](../../../packages/core/src/projects.ts).

### Retained package resources preserve producer authority

**When:** Origin in `9b839582`; prior ledger location 2175–2193;2234–2255;2392–2414;7340–7414.

A recipient lacking speech models or a pointer executor reads retained words and PNGs immediately. Imported published results retain original sampler/model/decoder identity and need no fake donor job. Raw transcript bytes plus reconstructed bounded receipt/index retain one ingestion format; regeneration is a separate explicit request.

**Gap:** Portable readiness and retained generation validation were unspecified.

**Reach:** Reading saved evidence cannot grant execution readiness or relabel it as current inference.

**Verdict:** sound. **Confidence:** high.

**Owner:** [project-packages.ts](../../../apps/service/src/project-packages.ts).

### Prepared audio publishes with queue settlement

**When:** Origin in `9b839582`; prior ledger location 2265–2287.

File preparation finishes privately, then the existing synchronous queue fence publishes its asset/receipt and revision references in the settlement transaction. Cancellation or a newer attempt blocks publication. Identical PCM assets may share bytes, but their source histories remain on separate publication/reference records.

**Gap:** Durable preparation did not choose atomic readiness and provenance ownership.

**Reach:** One queue/result graph owns prepared output without a second cache or global asset-level history.

**Verdict:** sound. **Confidence:** high.

**Owner:** [prepared-audio.ts](../../../packages/core/src/prepared-audio.ts).

### Local file identity is distinct from retained recipe identity

**When:** Origin in `9b839582`; prior ledger location 2265–2287.

A prepared file’s exact local filesystem identity is captured after dropping its staging hard link. Bounded readers refuse a substituted file rather than regenerate different bytes. Relocation adopts a new local file identity while preserving content and recipe.

**Gap:** Prepared immutable reads and relocation required different identity domains.

**Reach:** History/recipe portability does not weaken current filesystem authority.

**Verdict:** sound. **Confidence:** high.

**Owner:** [prepared-audio.ts](../../../packages/core/src/prepared-audio.ts).

### Prepared consumers select by complete recipe and pin their choice

**When:** Origin in `9b839582`; prior ledger location 3326–3347.

A moved project holds its saved processed PCM. Consumers compare the full revision recipe including upstream/model/state/rendition, report distinct matching policies as ambiguity, and refuse a broken match. Admission pins retained resource ID or explicit produced mode so later publication cannot change queued work.

**Gap:** Candidate selection and queued produced-versus-retained behavior were unspecified.

**Reach:** Offline playback preserves the recorded sound rather than selecting the newest policy.

**Verdict:** sound. **Confidence:** high.

**Owner:** [prepared-audio.ts](../../../packages/core/src/prepared-audio.ts).

### Output requests freeze resolved values separately from authoring

**When:** Origin in `9b839582`; prior ledger location 2335–2351;2415–2444;assets/09c-audio-export/choices.md.

An export asks for a preset and defaults later change. Replay uses the original resolved encoder settings, while a new export can resolve the new default. Equivalent resolved settings share rendering; original request identity still distinguishes replay. Mixing retains its 48-kHz stereo clock before requested output conversion.

**Gap:** Preset/replay identity and mix-versus-delivery format were unspecified.

**Reach:** Format changes cannot silently retime authored envelopes or invalidate an unchanged PCM mix.

**Verdict:** sound. **Confidence:** high.

**Owner:** [output-settings.ts](../../../packages/composition/src/output-settings.ts).

### Encoder selection distinguishes hard requirements from preferences

**When:** Origin in `9b839582`; prior ledger location 2415–2444.

A caller supplies a 64-bit GPU ID as an exact decimal string and chooses required hardware/software/GPU or an allowed preference. Preflight and actual writer enforce that request; receipts do not invent selected-session telemetry the SDK cannot observe. Null means leave a nullable encoder property unspecified, not silently ignore an unsupported explicit value.

**Gap:** Wire identity, hard selection and observable telemetry were unspecified.

**Reach:** Capabilities can disclose non-executable SDK knobs without presenting them as working controls.

**Verdict:** sound. **Confidence:** high.

**Owner:** [output-settings.ts](../../../packages/composition/src/output-settings.ts).

### Verify encoded headers before publishing

**When:** Origin in `9b839582`; prior ledger location 2335–2351.

A caller requests a H.264 profile and explicit level. Native reads bounded output metadata to verify the actual sequence parameters rather than merely echo the requested dictionary. Auto-level reports the encoder’s selected level.

**Gap:** Settings enforcement needed an output observation boundary.

**Reach:** Configuration acceptance alone cannot become proof that the writer honored the request.

**Verdict:** sound. **Confidence:** high.

**Owner:** [CompositionVideoOperation.swift](../../../helpers/mac/Sources/ScreenRecorderWire/CompositionVideoOperation.swift).

### Text is an ordinary visual clip

**When:** Origin in `9b839582`; prior ledger location 2469–2496.

A title follows video through the existing attachment graph and normal splits/moves/copies. Its literal text/style/font source has no playable stream or invented source clock; layout reuse compares exact UTF-16 code units so visually equivalent spellings cannot corrupt character ranges.

**Gap:** The plan did not prescribe a separate caption graph or literal layout cache identity.

**Reach:** One clip/asset/reference owner carries text rather than a parallel caption timeline.

**Verdict:** sound. **Confidence:** high.

**Owner:** [schema.ts](../../../packages/composition/src/schema.ts).

### Preserve alpha and refuse silent font substitution

**When:** Origin in `9b839582`; prior ledger location 2469–2496.

A transparent PNG remains transparent; an H.264 movie requires opaque final pixels rather than secretly applying a matte. Native text refuses missing glyph zero and runs supplied by another font, while requested finite-box clipping remains explicit layout behavior.

**Gap:** Shared picture/movie admission and missing-glyph semantics were unspecified.

**Reach:** A successful render cannot hide a substituted face, missing character or background.

**Verdict:** sound. **Confidence:** high.

**Owner:** [CompositionPictureExecutor.swift](../../../helpers/mac/Sources/ScreenRecorderFrames/CompositionPictureExecutor.swift).

### Caption seeds retain evidence without freezing display text

**When:** Origin in `9b839582`; prior ledger location 2543–2571.

An agent seeds a caption from selected spoken occurrences, then changes spelling or deletes that original clip. The caption keeps original word/generation provenance while edited text is independent. Package validation checks retained history, not whether the original occurrence still exists today.

**Gap:** Transcript-seed lifetime after later edits was unspecified.

**Reach:** Display corrections never rewrite source speech evidence.

**Verdict:** sound. **Confidence:** high.

**Owner:** [text-seeds.ts](../../../packages/core/src/text-seeds.ts).

### Public preparation pins an explicit revision

**When:** Origin in `9b839582`; prior ledger location 2528–2542.

An agent asks audio.prepare for a named revision. Existing job identity joins repeated requests and the retained result is an ordinary audio asset with its own published recipe. Editing current head does not change the old preparation; no extra request-intent table is added.

**Gap:** The public full-output preparation entry point and missing-revision semantics were unspecified.

**Reach:** Preparation remains distinct from a separately retained excerpt or a raw source read.

**Verdict:** sound. **Confidence:** high.

**Owner:** [audio-inspection.ts](../../../packages/core/src/audio-inspection.ts).

### Strict discovery describes authorable input accurately

**When:** Origin in `1b6aa64f`; prior ledger location 2456–2468;2590–2604;current cfa5d257.

A curve’s parsed keys are frozen internally, but callers must supply them. Shared CLI/MCP schema export removes misleading readOnly input annotations without weakening runtime validation. Capability discovery accepts the same strict empty-parameter shape on both adapters; extra fields refuse.

**Gap:** Schema-library immutability annotations and empty discovery argument validation were unspecified.

**Reach:** Agents learn the actual contract from one schema registry, including exact-time wording.

**Verdict:** sound. **Confidence:** high.

**Owner:** [operations.ts](../../../packages/protocol/src/operations.ts).

### Captured time separates raw provenance from admitted placement

**When:** Origin in `9b839582`; prior ledger location 2634–2651;2676–2687.

A device offers a buffer at a fractional host-clock phase. CaptureClock keeps raw timestamp provenance separately and classifies its samples on one declared admitted timeline; exact admitted addresses/support, not arbitrary raw nanoseconds through MOV, authorize later playback. Half-cell ties follow the named away-from-zero rule.

**Gap:** Physical platform timescales cannot preserve every raw timestamp under the public source contract.

**Reach:** Writer, canonical materializer and recovery share one clock rather than reader-specific fitted offsets.

**Verdict:** sound. **Confidence:** high.

**Owner:** [CaptureClock.swift](../../../helpers/mac/Sources/ScreenRecorderCapture/CaptureClock.swift).

### Media acceptance commits prospective clock state

**When:** Origin in `9b839582`; prior ledger location 2676–2699.

The first offered buffer is rejected by the media writer. Its prospective phase cannot become the phase of later accepted audio. If the writer accepts bytes and the subsequent journal append fails, native still finalizes those bytes but claims no acquisition for the unjournaled buffer.

**Gap:** Accepted-media state and journal failure ordering were unspecified.

**Reach:** Accepted is not durable or journaled; recovery cannot fabricate support from a counter alone.

**Verdict:** sound. **Confidence:** high.

**Owner:** [CaptureClock.swift](../../../helpers/mac/Sources/ScreenRecorderCapture/CaptureClock.swift).

### Mapping records alone never authorize source admission

**When:** Origin in `9b839582`; prior ledger location 2711–2721.

A packed journal says the writer accepted audio whose tail is not represented in the usable container. Internal publication consumes the exact physical mappings, but ordinary source evidence refuses packed staging until canonical materialization proves represented samples.

**Gap:** Accepted-versus-durable staging needed a trust boundary.

**Reach:** No summary or mapping array substitutes for verified source-time media.

**Verdict:** sound. **Confidence:** high.

**Owner:** [CaptureAudioMaterializer.swift](../../../helpers/mac/Sources/ScreenRecorderCapture/CaptureAudioMaterializer.swift).

### Recovery binds the exact validated journal prefix

**When:** Origin in `9b839582`; prior ledger location 2722–2731;5285–5304.

Lifecycle rows are appended after a candidate was prepared. Recovery keeps the original validated prefix’s byte length and digest, not a whole-file hash that changes or a reserialized sequence number. Later rows cannot expand the pinned attempt’s authority.

**Gap:** Growing journal provenance needed an immutable token.

**Reach:** One parser owns torn-tail/sequence interpretation for capture, retry and package verification.

**Verdict:** sound. **Confidence:** high.

**Owner:** [CaptureJournal.swift](../../../helpers/mac/Sources/ScreenRecorderCapture/CaptureJournal.swift).

### Normalize PCM representation at the track boundary

**When:** Origin in `9b839582`; prior ledger location 2763–2777.

A microphone changes from integer or planar PCM representation to floating interleaved bytes while keeping rate/channels. One current converter produces the established Float32 representation with an identity channel map; rate/channel changes refuse. A format cache cannot misread new bytes as the first representation.

**Gap:** Accepted format changes lacked a representation owner.

**Reach:** Capture supports equivalent representations without another timing or channel policy.

**Verdict:** sound. **Confidence:** high.

**Owner:** [CapturePCM.swift](../../../helpers/mac/Sources/ScreenRecorderCapture/CapturePCM.swift).

### The journal inode owns publication exclusion

**When:** Origin in `9b839582`; prior ledger location 2833–2843.

Two processes try to finish the same take. An OS file lock on the existing journal inode and pinned directory/file identities allows one publisher; process exit releases it. Close-on-exec and explicitly inherited authority avoid a PID registry or stale-lock cleaner.

**Gap:** Cross-process publication exclusion needed a concrete owner.

**Reach:** Every retry/materializer must hold the same original journal authority.

**Verdict:** sound. **Confidence:** high.

**Owner:** [CaptureJournalLease.swift](../../../helpers/mac/Sources/ScreenRecorderCapture/CaptureJournalLease.swift).

### Retain uncertain working audio even when a prefix is useful

**When:** Origin in `9b839582`; prior ledger location 2860–2873;3348–3376.

The journal records more accepted frames than the container decodes. A verified canonical prefix may publish, but automatic working-byte cleanup requires accepted, represented and completely decoded counts to agree with no unresolved tail. Missing journals and unjournaled physical tails remain retained.

**Gap:** Earlier cleanup counting could mistake partial representation for complete preservation.

**Reach:** Publication availability and permission to reclaim evidence remain separate facts.

**Verdict:** sound. **Confidence:** high.

**Owner:** [CaptureAudioMaterializer.swift](../../../helpers/mac/Sources/ScreenRecorderCapture/CaptureAudioMaterializer.swift).

### Complete verification uses bounded batches without shortening coverage

**When:** Origin in `9b839582`; prior ledger location 2874–2889.

A fragmented take would make one native reader spend too long setting up before cancellation. Canonical verification walks small occupied-run batches and maintains one continuous sample hash and exact placement/format check across them. Every sample is still required.

**Gap:** Long verification needed cancellable setup and bounded response work.

**Reach:** Batch size bounds working setup, not recording duration or a reduced preservation requirement.

**Verdict:** sound. **Confidence:** high.

**Owner:** [CaptureAudioMaterializer.swift](../../../helpers/mac/Sources/ScreenRecorderCapture/CaptureAudioMaterializer.swift).

### Unfinished publication is private and inspectable

**When:** Origin in `9b839582`; prior ledger location 2890–2903.

Stop leaves a private per-role attempt with immutable input intent and an optional prepared receipt. Before that receipt a candidate can be rebuilt; afterward retry verifies the same candidate. Unexpected files remain retained instead of recursive deletion, and published source stays available while cleanup is unresolved.

**Gap:** On-disk retry boundaries and unexpected-member cleanup were unspecified.

**Reach:** No second job manager or implicit evidence deletion follows from cancellation.

**Verdict:** sound. **Confidence:** high.

**Owner:** [CaptureSourcePublication.swift](../../../helpers/mac/Sources/ScreenRecorderCapture/CaptureSourcePublication.swift).

### Learned state uses current membership and ordered prefixes

**When:** Origin in `9b839582`; prior ledger location 2732–2762;2793–2818;2844–2859.

A clip splits with a stateful denoiser. The engine shares continuity using an allocated token on related pieces, while copies use fresh tokens. Current enabled membership and each step’s actual upstream prefix define connected prerequisites; equal adjacent configurations are not membership. Existing tokens reserve their IDs even after their original member disappears; get/set omission preserves engine-owned metadata and a caller cannot manufacture a fresh shared grouping token.

**Gap:** State instance identity, split/copy continuity and upstream dependency meaning were unspecified.

**Reach:** Matching settings cannot reconnect unrelated histories or reuse a stale state graph.

**Verdict:** sound. **Confidence:** high.

**Owner:** [processing-state.ts](../../../packages/composition/src/processing-state.ts).

### State repair removes invalid changed membership monotonically

**When:** Origin in `9b839582`; prior ledger location 2732–2762.

An edit moves members of a shared state domain across incompatible tracks or creates a dependency cycle. Normalization detaches shared state on participating changed occurrences until the graph is valid; each iteration removes membership, so it cannot repeat unchanged. Unchanged members and valid whole-group moves retain it; invalid imported graphs refuse.

**Gap:** The plan did not choose minimal repair versus simple bounded normalization.

**Reach:** Receipts disclose continuity changes instead of silently retaining impossible dependencies.

**Verdict:** sound. **Confidence:** high.

**Owner:** [processing-state.ts](../../../packages/composition/src/processing-state.ts).

### Parent state extent and authored activation are distinct

**When:** Origin in `9b839582`; prior ledger location 2793–2818;2844–2859.

A parent audio processor spans its structural audio children including internal timeline gaps. Its explicit processing window controls activation; missing source support is still missing evidence, not permission to reset the detector or feed invented samples. A short output window can require earlier eligible input.

**Gap:** Parent/window state semantics and range prerequisite expansion were unspecified.

**Reach:** Each ordered stateful prefix expands only its own connected domain.

**Verdict:** sound. **Confidence:** high.

**Owner:** [processing-state.ts](../../../packages/composition/src/processing-state.ts).

### Native input provenance must justify channel policy

**When:** Origin in `9b839582`; prior ledger location 2844–2859.

An audio stream’s admitted rate/channels travel with selected state inputs. Mono duplication, common scalar gain, authored silence and sum retain only their justified channel relation. Native opening verifies actual formats; stereo output alone cannot establish a dual-mono source.

**Gap:** Compiler metadata could not prove native channel facts.

**Reach:** Unknown provenance stays unknown, and consumed unavailable support blocks new learned preparation.

**Verdict:** sound. **Confidence:** high.

**Owner:** [CompositionAudioPlan.swift](../../../helpers/mac/Sources/ScreenRecorderAudio/CompositionAudioPlan.swift).

### Denoise strength is an explicit continuous wet/dry blend

**When:** Origin in `9b839582`; prior ledger location 3460–3470;3507–3515.

An agent fades denoising into a sentence. Mix zero selects the immediate input, one selects learned output and values between blend linearly at the existing parameter clock. Learned state stays continuous through zero mix so fading back does not restart acoustic history.

**Gap:** Strength automation did not specify a parameter or model tuning rule.

**Reach:** The fixed model recipe stays unchanged; new request identities capture the changed consumer mix.

**Verdict:** sound. **Confidence:** high.

**Owner:** [CompositionState.swift](../../../helpers/mac/Sources/ScreenRecorderAudio/CompositionState.swift).

### Publication-backed package clocks are verified against actual media

**When:** Origin in `9b839582`; prior ledger location 2928–2943;3004–3015;6033–6050.

An archive keeps every audio byte but shifts claimed start time by one microsecond. Admission probes the held canonical media and checks publication/journal proof against normalized support; file hashes alone cannot certify its clock. Completion mode remains native’s media-verification judgment.

**Gap:** Portable receipt integrity did not establish that its timing described the file.

**Reach:** Project metadata cannot recreate recovery judgments from one rounded duration.

**Verdict:** sound. **Confidence:** high.

**Owner:** [acquisitions.ts](../../../packages/core/src/acquisitions.ts).

### Source availability and cleanup report separate outcomes

**When:** Origin in `9b839582`; prior ledger location 2944–2956;3348–3376.

Canonical media is usable, but removing working files fails. Capture reports the usable terminal outcome plus bounded cleanupFailure rather than mislabeling successful capture as failure. Existing capture failure wins independently. Explicit cleanup joins the recording’s existing source-owned job and can report retained evidence.

**Gap:** Completion/cleanup result shape and explicit reclaim operation were unspecified.

**Reach:** A cleanup warning neither deletes uncertain bytes nor makes available sources unusable.

**Verdict:** sound. **Confidence:** high.

**Owner:** [capture-store.ts](../../../packages/core/src/capture-store.ts).

### Stop acknowledgments retain their authored lifecycle sequence

**When:** Origin in `9b839582`; prior ledger location 2957–2982.

Repeated Stop arrives while a prior finalizing acknowledgment is waiting for service report. The controller retains that earlier receipt rather than mixing its state with a later terminal sequence. A lost start reply may legitimately advance preparing directly to native-proved finalizing.

**Gap:** Acknowledgment interleavings and the preparing-to-finalizing jump were unspecified.

**Reach:** One event sequence has one meaning and recovery cannot override a still-owned writer from missing intermediate replies.

**Verdict:** sound. **Confidence:** high.

**Owner:** [CaptureController.swift](../../../apps/macos/Sources/ScreenRecorder/CaptureController.swift).

### Cancellation belongs to the existing termination task

**When:** Origin in `9b839582`; prior ledger location 2957–2982;5059–5077.

Cancel arrives while a finalizing report is held before publication starts. Native retains it for the existing sink, transfers it to the owned termination when created and clears it for a new take. Physical encoder/input closure still completes; cancellation ends publication or optional cleanup, not authority over a later take.

**Gap:** Cancellation could disappear across the report/termination await boundary.

**Reach:** Transport disconnect is not shared capture cancellation and no new task registry is needed.

**Verdict:** sound. **Confidence:** high.

**Owner:** [CaptureTermination.swift](../../../helpers/mac/Sources/ScreenRecorderCapture/CaptureTermination.swift).

### Source-owned jobs need no fictional recording edit revision

**When:** Origin in `9b839582`; prior ledger location 3305–3325;7618–7634.

A settled capture has recoverable audio but no playable editing revision. Cleanup jobs use its actual capture identity and null revision; project execution jobs require their explicit retained revision. Current admission rejects obsolete recording edit selectors.

**Gap:** Non-editing source work needed a queue target representation.

**Reach:** Cancellation/deletion/retry can manage incomplete sources without reviving a recording editor.

**Verdict:** sound. **Confidence:** high.

**Owner:** [jobs.ts](../../../packages/core/src/jobs.ts).

### Capture finalization failure stays with its durable lifecycle

**When:** Origin in `9b839582`; prior ledger location 3188–3198;3377–3386.

A take remains finalizing while source recovery runs. The existing capture service owns one cancellable attempt and bounded persisted error; explicit retry clears it when work begins and terminal settlement clears it. Reads expose that stored error without a second preparation registry for a take.

**Gap:** Responsive recovery needed durable failure storage before editable media existed.

**Reach:** Restart, stop and deletion coordinate through one capture owner.

**Verdict:** sound. **Confidence:** high.

**Owner:** [capture-store.ts](../../../packages/core/src/capture-store.ts).

### Old normalization receipts retain their exact declared grammar

**When:** Origin in `9b839582`; prior ledger location 3387–3399.

A historical source receipt omitted a raw terminal message that a newer normalizer exposes. Verification recognizes that original receipt version and compares all its original fields/hash; new receipts include the message/version. It does not broadly ignore arbitrary differences or rewrite old bytes.

**Gap:** Immutable receipt verification needed a narrow version boundary.

**Reach:** Generic source proofs can remain historical evidence without accepting incomplete new-format authority.

**Verdict:** sound. **Confidence:** high.

**Owner:** [source-admission.ts](../../../packages/core/src/source-admission.ts).

### Primary and camera publication proceed independently and join

**When:** Origin in `9b839582`; prior ledger location 5039–5058;6911–6970.

Camera verification takes longer than primary screen/audio publication. Native starts both independent publications, reports each actual outcome and joins both before releasing journals. Primary audio roles retain sequential budgeting, and simultaneous failures keep camera-first precedence independent of finish order.

**Gap:** Independent source progress/error arbitration was unspecified.

**Reach:** An available sibling is not hidden by another’s failure; no second finalization owner is added.

**Verdict:** sound. **Confidence:** high.

**Owner:** [NativeCapture.swift](../../../helpers/mac/Sources/ScreenRecorderCapture/NativeCapture.swift).

### Terminal source conflicts do not become success on another retry

**When:** Origin in `9b839582`; prior ledger location 5078–5097.

A conflicting file blocks camera publication while primary audio fails operationally. Removing that conflict before retrying primary does not upgrade the already terminal closed-camera result. Successfully published sources instead reverify their complete inputs/proof/bytes until take settlement.

**Gap:** Settled sibling outcomes versus unfinished operational retries were unspecified.

**Reach:** Retry cannot replace source authority or invent represented pictures.

**Verdict:** sound. **Confidence:** high.

**Owner:** [ClosedCameraSource.swift](../../../helpers/mac/Sources/ScreenRecorderCapture/ClosedCameraSource.swift).

### An uncertain terminal journal append is never repeated

**When:** Origin in `9b839582`; prior ledger location 5098–5116.

A finished row may reach disk before synchronization reports failure. The owner remembers that append attempt and later metadata/result retry cannot append a second finish record. Journal failure also cannot skip physical encoder finish.

**Gap:** Failure after a potentially effective journal write needed a retry boundary.

**Reach:** Recovery sees actual complete or incomplete evidence, never fabricated repaired history.

**Verdict:** sound. **Confidence:** high.

**Owner:** [CaptureJournal.swift](../../../helpers/mac/Sources/ScreenRecorderCapture/CaptureJournal.swift).

### Stale startup cleanup owns only its returned resources

**When:** Origin in `9b839582`; prior ledger location 5178–5199.

A screen lookup or camera start returns after the old take was discarded and another began. Generation checks fence each await and cleanup releases only the obsolete prepared input. Failed active startup joins the existing termination; it cannot clear newer take state.

**Gap:** Async startup resource authority was unspecified.

**Reach:** Selected inputs share one lifecycle without stale callbacks acquiring a new take.

**Verdict:** sound. **Confidence:** high.

**Owner:** [NativeCapture.swift](../../../helpers/mac/Sources/ScreenRecorderCapture/NativeCapture.swift).

### Input drain joins every attempted SDK start

**When:** Origin in `9b839582`; prior ledger location 5200–5221.

An SDK start can acquire resources before returning success or failure. The resource owner records the attempt before awaiting, then one cached drain joins startup and independently stops each attempted stream once. Once drain owns inputs, no later system-audio start is permitted.

**Gap:** Partial startup and discard interleavings lacked physical resource accounting.

**Reach:** A start error is never evidence that no cleanup is required.

**Verdict:** sound. **Confidence:** high.

**Owner:** [CaptureInputSession.swift](../../../helpers/mac/Sources/ScreenRecorderCapture/CaptureInputSession.swift).

### Picture digests retain their original serialization timescale

**When:** Origin in `9b839582`; prior ledger location 5305–5326.

A camera receipt’s picture digest serialized timestamps at a native tick rate. New receipts retain that exact rate and rational support. An old unbound receipt can qualify it only from held verified original raw media; guessing the canonical movie rate or rewriting history refuses.

**Gap:** Historical digest metadata omitted its time serialization basis.

**Reach:** Raw-less new sources can be portable without promoting unverifiable old sources.

**Verdict:** sound. **Confidence:** high.

**Owner:** [CameraMedia.swift](../../../helpers/mac/Sources/ScreenRecorderCapture/CameraMedia.swift).

### Acquisition observations grow but never change their earlier meaning

**When:** Origin in `9b839582`; prior ledger location 5530–5556.

Admission reserves its acquisition/job before all source files are openable. It freezes each observed file identity, distinguishes not-observed from observed-absent, and later retry validates existing observations before adding new ones. The job input stays constant instead of encoding a growing map into a new identity.

**Gap:** Durable partial progress needed an acquisition-owned representation.

**Reach:** A retry cannot import changed bytes or newly appearing optional media; explicit imports keep their stricter initial freeze.

**Verdict:** sound. **Confidence:** high.

**Owner:** [acquisitions.ts](../../../packages/core/src/acquisitions.ts).

### The shared capture store authorizes admission eligibility

**When:** Origin in `9b839582`; prior ledger location 5557–5579.

An admission caller cannot pass a fabricated complete take. Inside the queue transaction it reads the same catalog’s capture/source allocation and verified publication; active or canceled inputs refuse. The normalized journal must independently name that allocated source.

**Gap:** Capture facts and acquisition admission needed one authoritative lookup.

**Reach:** No copied lifecycle object or second catalog connection supplies closure authority.

**Verdict:** sound. **Confidence:** high.

**Owner:** [acquisitions.ts](../../../packages/core/src/acquisitions.ts).

### Discovery reads source admissions without starting work

**When:** Origin in `9b839582`; prior ledger location 5638–5686.

A capture reply exposes bounded primary/camera entries with actual allocated source, acquisition and job IDs. Null IDs distinguish unadmitted work; durable conflicts are explicit. Reads cannot import or retry. Existing startup/capacity notifications recover only settled sources with no intent, leaving failed/canceled existing jobs for explicit retry.

**Gap:** Durable admission discovery and missed notifications needed a representation.

**Reach:** Capture success survives queue pressure without a new backlog table or timer.

**Verdict:** sound. **Confidence:** high.

**Owner:** [capture-sources.ts](../../../apps/service/src/capture-sources.ts).

### Preserve historical receipts separately from current availability

**When:** Origin in `9b839582`; prior ledger location 5817–5836;5990–6012.

A source published earlier but a retry now finds changed or unreadable authority. Its last accepted receipt stays pinned to prevent silent replacement, while current observation governs donor access. A canceled later attempt cannot erase settled progress; an independently ready acquisition retains its own copies.

**Gap:** One frozen outcome could either hide current failures or lose immutable identity.

**Reach:** Historical success never overrides current availability and cancel never rewrites earlier facts.

**Verdict:** sound. **Confidence:** high.

**Owner:** [capture-store.ts](../../../packages/core/src/capture-store.ts).

### Allocate all selected source directories before inputs start

**When:** Origin in `9b839582`; prior ledger location 6013–6032.

An allocated take may crash before native camera preparation. Service allocation first creates every selected private destination; a bound writer accepts only an owned private empty existing directory. Retained members refuse before any mapping file can be truncated.

**Gap:** Late destination creation made missing storage indistinguishable from never-written source.

**Reach:** Empty-source recovery can observe real absence rather than invent it from a missing path.

**Verdict:** sound. **Confidence:** high.

**Owner:** [project-service.ts](../../../apps/service/src/project-service.ts).

### Camera origin preserves fractional first-picture support

**When:** Origin in `9b839582`; prior ledger location 5875–5895.

Camera arrives before primary with first timestamp 1,000,000.75 microseconds. It keeps a downward whole-microsecond origin and exact relative 0.75-microsecond picture time, rather than rounding the origin forward and rejecting valid negative-relative onset. An established primary retains its existing conversion.

**Gap:** Independent camera-first support needed an integer-origin conversion rule.

**Reach:** Mapping preserves exact accepted timing without inventing physical alignment or widening the journal clock.

**Verdict:** sound. **Confidence:** high.

**Owner:** [CameraWriter.swift](../../../helpers/mac/Sources/ScreenRecorderCapture/CameraWriter.swift).

### Camera acquisition order does not use nominal duration as outage

**When:** Origin in `9b839582`; prior ledger location 3856–3893.

A camera’s next PTS follows its previous PTS by slightly less than that callback’s nominal duration. Native accepts strictly ordered timestamps, retains the nominal duration as evidence and uses verified bounded presentation support. It does not discard a valid frame for overlap or manufacture a hole.

**Gap:** Callback duration did not establish acquisition ordering or actual outage boundaries.

**Reach:** Held presentation stays distinct from newly acquired pictures and physical sync remains separate.

**Verdict:** sound. **Confidence:** high.

**Owner:** [CameraWriter.swift](../../../helpers/mac/Sources/ScreenRecorderCapture/CameraWriter.swift).

### Removal requires the held donor directory identity

**When:** Origin in `9b839582`; prior ledger location 5768–5791.

The donor pathname is replaced after service opens it. Native deletion compares the requested entry to the held descriptor and refuses the mismatch, preserving both old and replacement directories. Existing targets without a descriptor refuse; an already absent target is harmless.

**Gap:** Native removal previously lacked enforcement of supplied directory authority.

**Reach:** No unanchored fallback can remove unrelated replacement media.

**Verdict:** sound. **Confidence:** high.

**Owner:** [capture-sources.ts](../../../apps/service/src/capture-sources.ts).

### Borrower cancellation does not permanently delete an acquisition

**When:** Origin in `9b839582`; prior ledger location 5746–5767.

Discard races native completion and can be refused because the take already settled. In-flight acquisition borrowers are canceled through ordinary queue cancellation, preserving explicit retry if completion wins. Ready acquisitions remain independent and donor retirement holds its real directory.

**Gap:** The shared retirement fence needed cancellation rather than premature permanent deletion.

**Reach:** Capture completion cannot be erased by an earlier guessed canceled state.

**Verdict:** sound. **Confidence:** high.

**Owner:** [capture-sources.ts](../../../apps/service/src/capture-sources.ts).

### Hash camera pixels directly under their existing lock

**When:** Origin in `9b839582`; prior ledger location 4548–4574.

Verification already owns a read-only BGRA pixel buffer. Synchronous hashing views that memory, grouping contiguous visible rows when possible and excluding stride padding, then releases the lock. Timestamp/dimension serialization stays unchanged.

**Gap:** The digest contract fixed content but not memory/call granularity.

**Reach:** No lifetime-spanning pointer cache or planar-image policy is introduced.

**Verdict:** sound. **Confidence:** high.

**Owner:** [CameraMedia.swift](../../../helpers/mac/Sources/ScreenRecorderCapture/CameraMedia.swift).

### Freeze primary proof on its actual journal writer queue

**When:** Origin in `9b839582`; prior ledger location 6911–6970.

Camera/primary progress reports can append live journal rows while primary verification runs. The existing writer queue copies/validates the primary’s immutable prefix before publication. Later reports remain legal but cannot expand that earlier proof; cancellation joins the queued copy before releasing authority.

**Gap:** Concurrent reporting needed an immutable source journal boundary.

**Reach:** Only the journal writer owns this copy and it never rebuilds missing evidence for an existing receipt.

**Verdict:** sound. **Confidence:** high.

**Owner:** [NativeCapture.swift](../../../helpers/mac/Sources/ScreenRecorderCapture/NativeCapture.swift).

### Retain exact generation before altering reference or joins

**When:** Origin in `9b839582`; prior ledger location 239–253;301–310;323–343;3594–3605.

A caller generates a phrase from one explicit local reference and transcript. The complete output is admitted at its verified frame-count/rate duration, not silently squeezed into a slot. Any trim, gain, fade, stretch or ambience is a separate explicit composition. Reference copies from different origins can share bytes without proving origin-lifetime behavior.

**Gap:** The reproduction needed bounded requests and a clear generated-duration/join boundary.

**Reach:** Generation remains an immutable source rather than an automatic replacement editor.

**Verdict:** sound. **Confidence:** high.

**Owner:** [voice-generation.ts](../../../packages/core/src/voice-generation.ts).

### Completed generation resolves before live model readiness

**When:** Origin in `9b839582`; prior ledger location 3626–3649.

A caller repeats an exact already completed generation after deleting installed models. It receives its retained audio/reference provenance without another inference or implicit installation. A request that actually requires synthesis checks the existing local model owner.

**Gap:** Replay admission ordering relative to model readiness was unspecified.

**Reach:** Model absence cannot invalidate existing bytes or alter saved request defaults.

**Verdict:** sound. **Confidence:** high.

**Owner:** [voice-generation.ts](../../../packages/core/src/voice-generation.ts).

### Voice origin selection is an explicit complete object

**When:** Origin in `9b839582`; prior ledger location 3706–3726.

The same reference asset came from two extracted projects. A caller echoes one stored typed origin object, which is validated and frozen with the request; omission selects no origin. Canonical record-key ordering preserves equivalent metadata, and generated provenance stores the derived origin hash without recursively expanding histories.

**Gap:** Stable attribution selection did not require a new hash-selector registry.

**Reach:** Later origins cannot redirect old requests or keep donor projects alive merely for attribution.

**Verdict:** sound. **Confidence:** high.

**Owner:** [voice-generation.ts](../../../packages/core/src/voice-generation.ts).

### Durable excerpts are separate from full-output preparation

**When:** Origin in `9b839582`; prior ledger location 3690–3705.

An agent keeps seven seconds of processed project audio as a new asset with audio.extract. It remains usable after deleting the donor project; historical extraction metadata describes where it came from but does not retain the project. audio.prepare separately retains its full pinned recipe/result.

**Gap:** Two useful lifetimes needed distinct public operation meanings.

**Reach:** Shared rendering/conversion/job publication does not create a separate voice-reference store.

**Verdict:** sound. **Confidence:** high.

**Owner:** [audio-extraction.ts](../../../packages/core/src/audio-extraction.ts).

### Finite audio conversion owns support, channel mapping and quota

**When:** Origin in `9b839582`; prior ledger location linked19e1 finite conversion decisions;03d duration receipt.

A complete selected Float32 file is converted for a voice reference or delivery. Its verified frame count bounds filter support; the separately floored output quota determines published length. Phase is continuous from selected frame zero; stereo-to-mono averages in Double then rounds once, mono-to-stereo duplicates, nonfinite output refuses. The converter may normalize signed zero.

**Gap:** Canonical conversion and exact-byte reuse needed a single numerical owner.

**Reach:** No clipping, normalization or reapplication of contributor masks is hidden inside conversion; byte-preserving reuse remains a separate verified path.

**Verdict:** sound. **Confidence:** high.

**Owner:** [SelectedAudioConversion.swift](../../../helpers/mac/Sources/ScreenRecorderAudio/SelectedAudioConversion.swift).

### Standalone encoding advertises its actual admitted formats

**When:** Origin in `9b839582`; prior ledger location assets/09c-audio-export/choices.md.

An agent asks output capabilities before choosing AAC mono/stereo at supported rates or WAV. Source import support and platform converter inventory do not grant MP3/FLAC/ALAC encoding. Native consumer status recognizes Audio and its real destination through the existing export UI without a new picker.

**Gap:** First-class audio output did not imply every codec or a new GUI workflow.

**Reach:** The public encoder domain stays truthful and independent of visual preparation.

**Verdict:** sound. **Confidence:** high.

**Owner:** [output-settings.ts](../../../packages/composition/src/output-settings.ts).

### Active audio resources are bounded by simultaneous work

**When:** Origin in `9b839582`; prior ledger location 3064–3080.

Ten thousand sequential short clips do not open ten thousand source readers. The mixer schedules only simultaneously readable occurrences, while separate structural plan bounds constrain total metadata. Completed state/prepared work can continue across source silence under its compiled recipe.

**Gap:** The earlier whole-plan decoder count bounded the wrong resource.

**Reach:** Large sequential projects stay possible without unbounded overlapping readers or another mixer.

**Verdict:** sound. **Confidence:** high.

**Owner:** [CompositionAudio.swift](../../../helpers/mac/Sources/ScreenRecorderAudio/CompositionAudio.swift).

### Store physical segment rows once and page them by ordinal

**When:** Origin in `9b839582`; prior ledger location 3119–3129;3151–3165.

A fragmented source contains occupied runs plus gaps at edges and between runs. Asset metadata stores its physical rows in an indexed table, preserving optional-versus-empty array meaning in its header. Stream summaries remain small; page reads do not parse the whole huge metadata string.

**Gap:** Probe cardinality and public/persisted representation were unspecified.

**Reach:** The common 200,001-row capacity preserves gaps rather than discarding them for a canonical-only exception.

**Verdict:** sound. **Confidence:** high.

**Owner:** [assets.ts](../../../packages/core/src/assets.ts).

### Public operation and job receipts have one compact owner

**When:** Origin in `9b839582`; prior ledger location 3130–3150.

A large edit returns its committed document only at revision.document, not a duplicate edit.document. Public job status returns the fingerprint of its complete internal recipe, not the entire plan. Historical saved meaning/IDs survive the development projection change without promising prior response byte identity.

**Gap:** Redundant document/recipe ownership overflowed bounded public delivery.

**Reach:** Receipts remain inspectable without raising transport limits or exposing a private recipe escape hatch.

**Verdict:** sound. **Confidence:** high.

**Owner:** [projects.ts](../../../packages/core/src/projects.ts).

### Recipe fingerprints accelerate lookup without replacing equality

**When:** Origin in `9b839582`; prior ledger location 3232–3282.

Polling a job uses a stored short SHA-256 and compact indexed summaries rather than reading a multi-megabyte recipe repeatedly. Admission/publication still compares full canonical inputs and refuses collisions. Export recovery uses its own bounded ordered index; execution retains the complete original snapshot.

**Gap:** Lookup/index shape and status work were unspecified.

**Reach:** Derived SQLite summaries are not another execution registry.

**Verdict:** sound. **Confidence:** high.

**Owner:** [jobs.ts](../../../packages/core/src/jobs.ts).

### Owner-presence checks do not deserialize media plans

**When:** Origin in `9b839582`; prior ledger location 3256–3264;3727–3738;6196–6206.

A cache/job status needs to know whether its asset or pinned revision exists. It checks that row under a nondeleted owner without parsing every media segment/document. Actual preparation/inspection still resolves and validates complete metadata/file authority.

**Gap:** Presence-only consumers had incidental expensive parser work.

**Reach:** Missing/deleted owners retain their error semantics without a mutable model cache.

**Verdict:** sound. **Confidence:** high.

**Owner:** [project-service.ts](../../../apps/service/src/project-service.ts).

### Batch only independent edits while preserving earlier refusals

**When:** Origin in `9b839582`; prior ledger location 3094–3104;3283–3295;3471–3478;6207–6228.

Many stateless stacks or append placements can share one full candidate validation, but repeated targets, symbolic forward dependencies and stateful normalization keep ordinary sequential processing. A later track creation cannot legalize an earlier placement that referred to a missing track. Failure search reports the same earliest invalid prefix and receipts/IDs stay ordered.

**Gap:** Fast-path eligibility was unspecified.

**Reach:** One editor/validator avoids quadratic work without changing atomic semantics or hiding intermediate invalidity.

**Verdict:** sound. **Confidence:** high.

**Owner:** [edits.ts](../../../packages/composition/src/edits.ts).

### Metadata sharing ends at each synchronous validation phase

**When:** Origin in `9b839582`; prior ledger location 6133–6141;6252–6261;6813–6861.

Many source selections read their asset/acquisition rows together and decode a row only when its source is reached. All streams’ physical segments are read once in header order, so later malformed metadata cannot hide earlier failure. A publication await or new request ends reuse; fresh status checks remain required.

**Gap:** Batching needed error-order and freshness boundaries.

**Reach:** No cross-request map or stale evidence cache becomes source authority.

**Verdict:** sound. **Confidence:** high.

**Owner:** [source-selection.ts](../../../packages/core/src/source-selection.ts).

### Deduplicate retained resources without deduplicating occurrences

**When:** Origin in `9b839582`; prior ledger location 6142–6150;6169–6175;assets/24z2-prepared-admission/choices.md.

Four clips use two media sources. Admission retains first-encounter asset/acquisition resources separately by kind, but recipes keep all four occurrence mappings. File-address resolution is a separate current-window step; moving a scratch asset path cannot leave execution bound to an older locator.

**Gap:** Unique resource ordering and current execution binding were unspecified.

**Reach:** Equal textual IDs in different resource kinds remain distinct and no persistent binding cache is added.

**Verdict:** sound. **Confidence:** high.

**Owner:** [prepared-audio.ts](../../../packages/core/src/prepared-audio.ts).

### Demanded frames transport only the contributing support interval

**When:** Origin in `9b839582`; prior ledger location 6229–6251.

A raw picture asks for one instant in a segment-rich source. Core validates complete selected support/digest; the worker receives only the interval containing that point. Indexing separately receives full support, including when time zero is a gap.

**Gap:** A point request did not need every support row in its bounded control message.

**Reach:** Transport narrowing cannot weaken later-unrequested interval authority or native sample selection.

**Verdict:** sound. **Confidence:** high.

**Owner:** [frame-inspection.ts](../../../packages/core/src/frame-inspection.ts).

### Skip absent evidence only when no publication can contribute

**When:** Origin in `9b839582`; prior ledger location 3479–3487.

A project has editorial cuts but imported sources with no capture/scene rows. The event merger omits those empty lanes without spending source-read work. Publication pins remain; newly published evidence invalidates the manifest and a missing file behind a publication still fails.

**Gap:** Large occurrence traversal needed a no-contributor rule.

**Reach:** Absence shortcuts cannot suppress a real published failure or imply unchanged future status.

**Verdict:** sound. **Confidence:** high.

**Owner:** [project-events.ts](../../../packages/core/src/project-events.ts).

### Audio identification and decoder demand are separate finite scopes

**When:** Origin in `9b839582`; prior ledger location 3562–3581.

An inherited handle has no filename and ID3 may precede more than MP3. Known signatures choose a route; AudioToolbox identifies ambiguous input through owned positional reads within a finite allowance. Whole-file streaming can continue afterward, while inspection charges all its reads to its existing ceiling.

**Gap:** Descriptor-based format detection and streaming recognition cost were unspecified.

**Reach:** No hand-written tag/frame parser, direct descriptor URL bypass or infinite malformed-header scan is added.

**Verdict:** sound. **Confidence:** high.

**Owner:** [AudioSource.swift](../../../helpers/mac/Sources/ScreenRecorderAudio/AudioSource.swift).

### Tell the loader when local bytes are complete

**When:** Origin in `9b839582`; prior ledger location 3528–3549;3582–3593.

A local clip is already fully present in the owned file. The loader declares available-on-demand data so platform metadata can seek directly, retaining the same descriptor and inspection budget. Decoding receives its actual finite selected end, independent of metadata identification.

**Gap:** Platform metadata-loading mechanism was unspecified.

**Reach:** Local availability does not authorize unconstrained decoder read-ahead.

**Verdict:** sound. **Confidence:** high.

**Owner:** [AudioSource.swift](../../../helpers/mac/Sources/ScreenRecorderAudio/AudioSource.swift).

### Report decoded work and source I/O without claiming hidden totals

**When:** Origin in `9b839582`; prior ledger location 3516–3527.

A short excerpt can decode few samples but read much of its file. Native reports decoded frames and successful positional-loader reads separately; retired readers are counted once. Pathname and retained-PCM paths explicitly report unknown I/O rather than partial telemetry as a total.

**Gap:** Performance measurements needed existing-owner accounting.

**Reach:** Future resource claims must state the observed domain rather than infer work from output duration.

**Verdict:** sound. **Confidence:** high.

**Owner:** [AudioSource.swift](../../../helpers/mac/Sources/ScreenRecorderAudio/AudioSource.swift).

### One native error owner classifies actual cancellation

**When:** Origin in `9b839582`; prior ledger location 8055–8074.

Swift CancellationError reaches the shared NativeWire responder and maps to CANCELED with its operation details. A genuine decode error is not overwritten just because its task is also canceled; retry stays explicit.

**Gap:** Shared error mapping omitted the actual cancellation type.

**Reach:** All native operations retain the same failure meaning without movie-local retry/error shims.

**Verdict:** sound. **Confidence:** high.

**Owner:** [Wire.swift](../../../helpers/mac/Sources/ScreenRecorderWire/Wire.swift).

### One retained directory publisher has explicit release and discard

**When:** Origin in `9b839582`; prior ledger location 7860–7945.

A camera candidate needs to survive a failed publication for recovery. Releasing its file owner closes handles but retains bytes; explicit discard clears only its owned staging contents. Publication rollback removes only a new destination link created by that invocation that still names its selected file, never a prior successful retry link.

**Gap:** Retained handle lifetime and late receipt rollback were unspecified.

**Reach:** One publisher/scanner preserves recovered candidates and unrelated destination bytes.

**Verdict:** sound. **Confidence:** high.

**Owner:** [OutputFile.swift](../../../helpers/mac/Sources/ScreenRecorderMedia/OutputFile.swift).

### Movie header finalization keeps the writer’s exact file handle

**When:** Origin in `9b839582`; prior ledger location 7817–7837.

An unrelated process replaces a movie’s staging pathname after the writer opens it. The mux keeps that descriptor and verifies the locator before bounded header finalization, refusing rather than editing replacement bytes. Cleanup/publication still follow their common directory owner.

**Gap:** Header repair needed the original writer output identity.

**Reach:** No new filesystem watcher or generalized import-repair operation appears.

**Verdict:** sound. **Confidence:** high.

**Owner:** [MovieAudioTail.swift](../../../helpers/mac/Sources/ScreenRecorderWire/MovieAudioTail.swift).

### One app-owned socket launches the canonical service

**When:** Origin in `9b839582`; prior ledger location 6098–6120;8269–8290.

The default CLI discovers the app’s existing runtime socket and startup lock; the app owns one canonical project service child. Missing responses do not select another engine or retry mutations. Explicit scratch-home/preferences selection travels through the same launcher when supplied.

**Gap:** Temporary library-local socket and scratch preference halves did not match ordinary discovery.

**Reach:** There is no second listener, discovery fallback, daemon or implicit project creation.

**Verdict:** sound. **Confidence:** high.

**Owner:** [main.ts](../../../apps/service/src/main.ts).

### Unanswered export actions remain uncertainty rather than success

**When:** Origin in `9b839582`; prior ledger location 5445–5506.

A retry reply times out or cannot be decoded. Native keeps the last readable receipt plus read failure and polls authoritative status, even if the old state was stopped. A definite refusal remains an action failure instead of polling forever. Discovery retains its first traversal error while admitting later valid items.

**Gap:** Consumer state could not distinguish refused action from unreadable observation.

**Reach:** No extra mutation/retry queue is created and later status cannot erase an independent refusal.

**Verdict:** sound. **Confidence:** high.

**Owner:** [ExportController.swift](../../../apps/macos/Sources/ScreenRecorder/ExportController.swift).

### The presenter owns the platform surface, not service lifetime

**When:** Origin in `9b839582`; prior ledger location 5580–5637.

PreviewController validates project/revision/lease before giving a movie to its concrete window/player presenter. Closing, player failure and stale callbacks return to the same generation-fenced controller. A controlled presenter can observe requests without becoming a second decoder, token owner or playback policy.

**Gap:** Platform objects and service state needed a testable boundary.

**Reach:** Native project presentation remains one controller with explicit resource ownership.

**Verdict:** sound. **Confidence:** high.

**Owner:** [PreviewController.swift](../../../apps/macos/Sources/ScreenRecorder/PreviewController.swift).

### Automatic reads remain on the selected socket

**When:** Origin in `9b839582`; prior ledger location assets/24z12-mcp-media-admission/choices.md;assets/24z13-cli-delivery-selection/choices.md.

A media call discovers one service socket, then uses that path and cancellation signal for every read. If the listener disappears, later items return ordinary connection errors; the client does not rediscover/launch a different app to consume the old lease. Restart token expiry stays service-owned.

**Gap:** Discovery versus multi-item delivery needed a lifetime boundary.

**Reach:** Batch order, duplicates and per-item failures retain current adapter meaning without an invented instance ID.

**Verdict:** sound. **Confidence:** high.

**Owner:** [README.md](../../../apps/cli/README.md).

### Complete operation results use one outer delivery lease

**When:** Origin in `9b839582`; prior ledger location 6292–6305;8143–8185.

A large edit has already run when its JSON result becomes an artifact reference. One shared consumer reads bounded chunks, verifies count/digest/response identity and returns the same typed data/error as inline delivery. Finally it closes only that outer lease; media tokens inside the JSON remain with their caller. Reading and cleanup failures both remain inspectable.

**Gap:** Legal service frames can exceed MCP quoted/structured wrapper capacity.

**Reach:** Retrieving results never reruns a mutation or closes unrelated nested media.

**Verdict:** sound. **Confidence:** high.

**Owner:** [operations.ts](../../../packages/protocol/src/operations.ts).

### Normalize decoded video at its existing image boundary

**When:** Origin in `9b839582`; prior ledger location 6410–6452;assets/23l2-project-source-colors/choices.md.

A raw video frame and the same decoded picture in a project PNG should carry corresponding source colors while every authored graph operation still runs. FrameImage normalizes all available decoded video readers at that boundary. ImageIO stills keep their existing precision/path; they are not rasterized again simply because video requires this correction.

**Gap:** The project/raw picture discrepancy needed one general source representation owner.

**Reach:** The rule adds no identity-source shortcut, new public API or unrelated still-image quantization.

**Verdict:** sound. **Confidence:** high.

**Owner:** [FrameImage.swift](../../../helpers/mac/Sources/ScreenRecorderFrames/FrameImage.swift).

### Every edited selector gets its own qualified physical reference

**When:** Origin in `9b839582`; prior ledger location 6355–6369;assets/23l-paired-edited-frames/choices.md.

Old recording selection and current globally sampled projects can choose different pictures at a join. Each bounded comparison resolves its physical sample using independent complete support and retains a reference for that selector. Integer requests name proven containing samples, not guessed nearest pictures.

**Gap:** Preservation did not imply identical selectors or source clocks.

**Reach:** A reference mismatch cannot be hidden by forcing two different selections to agree.

**Verdict:** sound. **Confidence:** high.

**Owner:** [choices.md](assets/23l-paired-edited-frames/choices.md).

### Independent sample oracles consume authored boundaries

**When:** Origin in `9b839582`; prior ledger location 3064–3080;3178–3187;4125–4199;7530–7564;7838–7859;3997–4013;2983–2997.

A fixture cuts and reorders known tones or impulses. Its oracle derives source and placement sample indices from explicit authored ranges and the declared sample rate, not compiler-produced expected PCM. Gain is applied to an already independent dry stem; learned output is judged only after its upstream prefix matches retained samples. The linked-stereo file stretch reference accesses complete planar channel vectors from the same selected engine, providing a different addressing layout; its measured channel residuals are not replaced by a perfect-coherence promise.

**Gap:** Numeric delivery checks needed independent inputs without duplicating every DSP algorithm.

**Reach:** A shared wrong mix cannot certify itself through WAV/movie or native/TypeScript agreement.

**Verdict:** sound. **Confidence:** high.

**Owner:** [README.md](../../../packages/test-harness/editing/README.md).

### Codec oracles encode expected PCM for the same requested window

**When:** Origin in `9b839582`; prior ledger location 4180–4199;4275–4304.

An edited movie contains retimed and processed audio. The fixture builds an independently expected PCM source in a plain unit-rate project and encodes that exact selected window with matching settings. Cropping a full AAC reference is not equivalent to encoding a short range because codec tails can differ.

**Gap:** Movie-versus-WAV agreement alone could share the same incorrect mix.

**Reach:** Lossy delivery remains distinct from exact upstream PCM and audible quality.

**Verdict:** sound. **Confidence:** high.

**Owner:** [README.md](../../../packages/test-harness/editing/README.md).

### Fault fixtures change the real boundary they claim to test

**When:** Origin in `9b839582`; prior ledger location 3296–3304;6281–6291;7078–7141;7268–7339;7741–7790;5327–5343;6271–6280.

An edit actually commits, then a small socket proxy withholds its recorded successful response so the client experiences reply loss. Retry reads the true saved receipt. Filesystem limits, SQLite triggers or held descriptors inject their named faults after valid inputs, rather than malformed setup failing before the contract. A growing mapping file is observed through its actual reader’s captured byte boundary; portable relocation uses ordinary writes and the runner’s setup lifecycle rather than overriding transactions. Reset after a timed-out committed edit uses public restore and its required fresh revision/request IDs, preserving the original receipt instead of rewriting catalog history.

**Gap:** Repeatable crash/acknowledgment/rollback proof needed fault placement.

**Reach:** Controlled fixtures add no production failure flags and preserve the accepted producer separately from falsification.

**Verdict:** sound. **Confidence:** high.

**Owner:** [README.md](../../../packages/test-harness/editing/README.md).

### Owned process cleanup uses observed children and groups

**When:** Origin in `9b839582`; prior ledger location 6678–6705;7163–7180;7078–7141;7420–7449;7759–7775.

A fault fixture starts its own process group or captures a child’s actual group and live parent, waits for the named work boundary, then kills and reaps only its owned descendants on failure. A bare historical PID or assumed inherited group cannot authorize cleanup.

**Gap:** Failed handshakes and Foundation child groups made marker-only cleanup unreliable.

**Reach:** Tests do not leave unrelated native work alive or add production process searches.

**Verdict:** sound. **Confidence:** high.

**Owner:** [README.md](../../../packages/test-harness/editing/README.md).

### Keep finite acoustic research references independent

**When:** Origin in `9b839582`; prior ledger location 1411–1453;1667–1681;6560–6585;6879–6895.

A corpus’s human-checked text can evaluate recognition but its automatically assigned times cannot independently evaluate word boundaries. Full supplied-text alignment uses saved recognized text, never human timing labels as input. Research-restricted source/output stays in declared private storage; hashes and aggregate evidence retain identity.

**Gap:** Alternative evaluation needed independent reference and artifact ownership.

**Reach:** Publisher unseen metadata does not prove held-out training exclusion, and a numerical example never selects a new recipe.

**Verdict:** sound. **Confidence:** high.

**Owner:** [speech-readiness.md](assets/acceptance-maintenance/speech-readiness.md).

### Save annotation snapshots with bound bytes and clock

**When:** Origin in `9b839582`; prior ledger location 4733–4755;4756–4769;4784–4826;4904–4917.

The marking page loads the complete small clip before enabling work, so seeking survives a later server stop. A completed Next saves a new local snapshot, with fields frozen during save and values retained on failure. Audio/source hashes and exact source-clock interval bind exported word targets; partial/skipped edges remain unknown and reopening does not invent autosaved authority.

**Gap:** Media/server lifetime, save concurrency and export schema were unspecified.

**Reach:** Submitted marks cannot overwrite original evidence or inherit confirmation after an unreviewed edit.

**Verdict:** sound. **Confidence:** high.

**Owner:** [choices.md](assets/12d-marking-page-ui/choices.md).

### Representative MCP coverage owns the adapter boundary

**When:** Origin in `9b839582`; prior ledger location 6327–6354;6481–6492.

A fresh independent MCP caller discovers schemas, reads a pinned revision, exercises replay/refusal and receives complete default-SDK delivery using a tiny authored still-image hold. It does not repeat every already completed CLI effect merely to duplicate media work; model readiness remains a separate prerequisite.

**Gap:** CLI/MCP acceptance did not prescribe duplicating a full effect journey.

**Reach:** Public composition scope remains broad while distinct adapter behavior has its own concrete request.

**Verdict:** sound. **Confidence:** high.

**Owner:** [choices.md](assets/25-input-preparation/choices.md).

### Private installation proof names the exact candidate

**When:** Origin in `9b839582`; prior ledger location 8269–8312.

A private supported app/launcher is cold-launched through ordinary discovery with scratch library/preferences. Its exact executable and service child must supply the answer even when a personal app shares its bundle ID. Qualified original manifests and owned process identities remain separate; only the private processes are terminated.

**Gap:** Installed discovery needed isolated observation without using the personal library.

**Reach:** An older live app’s response cannot establish the candidate’s launch/runtime contract.

**Verdict:** sound. **Confidence:** high.

**Owner:** [README.md](assets/23-owner-fixture-ports/README.md).

### Current fixtures use real owners without reviving retired carriers

**When:** Origin in `9b839582`; prior ledger location 6971–7141;7142–7706;7719–7790;4377–4409;5406–5444.

A preservation check now authors explicit projects/source selections and exercises current catalog, queue, lease/publication/archive owners. Controlled media responses are appropriate when only lifetime is judged; independent native/sample/color cases retain their actual media boundary. Shared fixture setup is reused per contract rather than a universal wrapper or old recording editor. New supported-color fixtures preserve old refused media unchanged, and a tiny stretched replacement explicitly tests plane isolation rather than representative visual quality. Populated source-event fixtures combine declared synthetic scenes with unchanged captured journal authority, not invented acquisition events. Lifecycle oracles retain every journal row and collapse only adjacent finalizing progress for their state-transition comparison; other duplicate transitions remain visible.

**Gap:** Owner cutover left useful guarantees inside obsolete fixtures.

**Reach:** A typecheck, scripted payload or borrowed proof never becomes evidence of a different native operation.

**Verdict:** sound. **Confidence:** high.

**Owner:** [README.md](../../../packages/test-harness/editing/README.md).

### Formatting respects published artifact byte identity

**When:** Origin in `9b839582`; prior ledger location 7707–7718.

A registered profile is hashed into its prepared runtime inventory. Cosmetic formatting would change those bytes even if parsed settings match, so the existing ignore list protects published model metadata and frozen vendor provenance. Updating them remains an explicit artifact change.

**Gap:** Default formatting did not distinguish code style from published byte operands.

**Reach:** Ordinary formatting cannot silently replace a runtime profile/inventory.

**Verdict:** sound. **Confidence:** high.

**Owner:** [.prettierignore](../../../.prettierignore).

### Fixture outcomes follow declared requests without rewriting failures

**When:** Origin in `9b839582`; prior ledger location 8351–8411.

A caller completes its required image delivery and then performs an extra read of the consumed token. The extra failure remains in process evidence but does not invent a failed required delivery or extend the token lifetime. Saved temporal review selects frames immediately around authored caption/still/zoom boundaries, rather than inferring boundaries from interior stills.

**Gap:** A whole script exit and sparse snapshots did not identify the exact requested contract.

**Reach:** Required effects, extra expectations, continuous playback and listening remain separately attributable.

**Verdict:** sound. **Confidence:** high.

**Owner:** [README.md](assets/23-owner-fixture-ports/README.md).

### Changed source bindings require repair of source-anchored processors

**When:** Origin in `9b839582`; prior ledger location 416–466; source-domain replacement invariant.

A replaced clip has a processor whose activity window names the old source’s content. Changing that media selection or adding padding cannot silently reinterpret the window against new bytes. Replacement asks the caller to repair/reset those source-domain steps while separately applying its requested keep/reset policy.

**Gap:** Processing retention could otherwise preserve settings whose time anchor no longer describes the source.

**Reach:** Media replacement must keep identity and processor timing authority coherent rather than silently delete or retarget a source window.

**Verdict:** sound. **Confidence:** high.

**Owner:** [replace.ts](../../../packages/composition/src/replace.ts).

### File pages preserve complete-run stretch semantics

**When:** Origin in `9b839582`; prior ledger location 3957–3973.

A long selected run must keep the chosen stretch algorithm’s complete-input behavior without mapping entire input/output arrays into memory. Its unchanged adapter receives indexed file pages and preserves exact tail correction and selected context; input can be revisited and temporary disk grows with output. Bounded checks do not interrupt every blocked OS call or upstream loop.

**Gap:** The research array adapter did not define production memory strategy.

**Reach:** Native preparation uses the selected recipe rather than substituting independent processing chunks or a duration-based engine switch.

**Verdict:** sound. **Confidence:** high.

**Owner:** [CompositionRetime.swift](../../../helpers/mac/Sources/ScreenRecorderAudio/CompositionRetime.swift).

### The stretch caller owns descriptors and publication

**When:** Origin in `9b839582`; prior ledger location 3974–3990.

Preparation receives an immutable input descriptor and a distinct empty read/write output descriptor. One checked recipe underlies file/array entry points; invalid aliases or unsafe derived seeks refuse. The caller discards partial output on failure and publishes only after complete success, while the library opens no paths or derivative registry.

**Gap:** The processor needed a finite cancellable file contract and an explicit publication boundary.

**Reach:** Prepared-audio/job owners retain publication and source identity without another cache or queue.

**Verdict:** sound. **Confidence:** high.

**Owner:** [CompositionRetime.swift](../../../helpers/mac/Sources/ScreenRecorderAudio/CompositionRetime.swift).

### Prepared-run readers open only for active block work

**When:** Origin in `9b839582`; prior ledger location 4014–4028.

A timeline contains hundreds of prepared retimed runs. After preparation their writer descriptors close, retaining immutable scratch paths; each bounded read opens its current file and closes afterward. Holding one descriptor for every run would exhaust the app’s ordinary descriptor budget even when one plays.

**Gap:** The complete-run preparation lifetime did not specify later reader residency.

**Reach:** File-open cost buys simple bounded descriptor use without a reader cache or product clip cap.

**Verdict:** sound. **Confidence:** high.

**Owner:** [CompositionRetime.swift](../../../helpers/mac/Sources/ScreenRecorderAudio/CompositionRetime.swift).

### Owned camera peers report explicit empty and unknown facts

**When:** Origin in `9b839582`; prior ledger location 5009–5018.

A native device reply has no available cameras and permission is unknown. It must send an explicit empty camera list and unknown permission value. Missing fields are an invalid owned-peer response, not evidence of no device or a denial; current camera selection still uses its actual validated lifecycle.

**Gap:** New device fields had no omission rule.

**Reach:** Every owned producer/consumer shares truthful camera facts without a compatibility fallback.

**Verdict:** sound. **Confidence:** high.

**Owner:** [capture.ts](../../../packages/protocol/src/capture.ts).

### Source-index helpers consume the fresh normalized plan

**When:** Origin in `9b839582`; prior ledger location 6262–6270.

A source-index request computes its selected frame options once and passes them to the existing recipe helper. Its later executor independently resolves a fresh plan and full source support, including a gap at timestamp zero. A diagnostic can stop at the existing cancellation boundary without changing ordinary execution.

**Gap:** Internal normalized-option reuse and bounded diagnostic setup were unspecified.

**Reach:** One recipe owner avoids repeat lookup without retaining paths/status across execution or adding another cache.

**Verdict:** sound. **Confidence:** high.

**Owner:** [source-index-selection.ts](../../../packages/core/src/source-index-selection.ts).

### Frozen and actual speech use one bounded public fixture journey

**When:** Origin in `9b839582`; prior ledger location 5151–5168.

A developer supplies either frozen speech replies or the explicitly prepared real model directory to the same public admission/transcript/edit/restart journey. The fixture readiness declaration stays distinct from genuine production preparation. Its request record reserves each native attempt and exact request before dispatch, then saves success or error in order; failed launch still consumes an attempt.

**Gap:** Public parity did not specify duplicate runners or durable failed-attempt accounting.

**Reach:** One fixture operation sequence cannot drift into a second inference policy or hide failure by counting only successes.

**Verdict:** sound. **Confidence:** high.

**Owner:** [README.md](../../../packages/test-harness/editing/README.md).

### Prerecorded pause and terminal fixtures exercise actual timing owners

**When:** Origin in `9b839582`; prior ledger location 3411–3429.

A deterministic decoded input waits for the recorder’s actual pause/resume, excludes offered buffers intersecting that observed interval, and independently derives expected source placement for both roles. Separate copied states omit or tear a terminal journal suffix after publication; recovery retains sources without inventing a completed finish.

**Gap:** Offline pause and interrupted persistence needed concrete controlled operands.

**Reach:** These fixtures verify writer/recovery mechanics, not live device synchronization, hardware power loss or listening.

**Verdict:** sound. **Confidence:** high.

**Owner:** [CaptureJournal.swift](../../../helpers/mac/Sources/ScreenRecorderCapture/CaptureJournal.swift).

### Stale export discovery resweeps through its existing generation

**When:** Origin in `9b839582`; prior ledger location 5729–5745.

A status reply arrives after a newer discovery/deletion operation changed native export state. The bounded generation counter rejects that old traversal, and the existing pending-sweep flag requests one current resweep. It does not publish stale rows or create an accumulating parallel catalog/retry loop.

**Gap:** Concurrent discovery mutation did not specify snapshot validity.

**Reach:** The existing consumer remains the sole asynchronous export writer.

**Verdict:** sound. **Confidence:** high.

**Owner:** [ExportController.swift](../../../apps/macos/Sources/ScreenRecorder/ExportController.swift).
