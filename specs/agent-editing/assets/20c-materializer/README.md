# Shared capture PCM materializer checkpoint

`CaptureAudioMaterializer` now owns reconciliation, canonical construction and canonical-only revalidation below Wire. It requires an exclusive journal lease and an exact validated byte prefix. It returns candidate facts; it never publishes a receipt or deletes working media. Normal writer/recovery activation and service deadline integration remain in 20d. This is not complete capture rollout.

Accepted journal mappings are streamed and coalesced only when both physical and declared native addresses join. A packed source scan proves packet address continuity and stops at the first unprovable interior boundary. Accepted frames past physical EOF and physical frames without accepted mappings remain distinct. Only the proven prefix is represented; a clipped last run retains its original phase and source address.

A completed presentation reader is insufficient for cleanup: an edit can hide later samples. The scan also checks the underlying media cursor extent. `cleanPhysicalEOF` means all platform-indexed PCM was decoded; it does not classify arbitrary unindexed container bytes. A readable prefix may be publishable while cleanup remains forbidden. Healthy cleanup additionally requires accepted = committed = represented, a rule owned by publication.

## Proof and measured cost

The focused tests use the banked actual-writer PCM at 44.1/48kHz. Complete source windows are compared against the authored waveform and independent sample-clock lengths, including non-grid phase, gaps, late windows and final-run clipping. They cover callback grouping, empty accepted evidence, torn suffixes, hidden physical tails, format/missing/corrupt input, idempotent candidates, pre-cancellation, and canonical revalidation after both packed and canonical pathnames disappear. A mutation that ignored the underlying media extent failed the hidden-tail assertion; restoring the check passed the default capture suite.

The first verifier reopened a reader for each run. A matched 10k-run operation took 55.78s. A single dense read improved that to 5.90s, but 100k runs caused a 48.17s synchronous reader start. The final verifier makes temporary read-only dense compositions of at most 1,024 runs, keeps one continuous PCM digest across batches and checks cancellation at platform boundaries. It does not write a second media artifact or impose a recording-length limit.

The complete 100,000-run materialization represented 192,000 original frames exactly in 125.676s. Peak worker RSS was 1.572GB, dominated by platform export; the slowest observed verification batch was approximately 1.69s. A separate cancellation replay requested cancellation at 60s and returned at 60.134s with 113MB peak RSS and unchanged inputs. These are observations on one host, not latency or memory guarantees. The 100k exact-run preflight remains a provisional measured materializer capacity; projection into admission evidence and narrower existing consumer bounds still require integration proof.

A 76.8MB canonical file containing 19.2 million known frames passed descriptor-only revalidation in 0.147s after both original pathnames were removed. The default 64MiB descriptor inspection budget still refused that full read. Only this whole-file verifier explicitly selects streaming access; it retains pinned descriptor ownership, chunk/request bounds and cancellation. A cancellation control preserved the same file identity. The duration fixture repeats the frozen two-second waveform 200 times and is not a real long recording.

The outer product budgets are 10 seconds for native control and 30 seconds for media workers, including recovery. The successful 125.7s native operation does **not** satisfy those defaults. 20d must connect existing finalizing/attempt ownership and per-operation deadline behavior so ordinary supported input can complete or retry safely. No global timeout was widened here.

## Integrity contract

The digest formats are defined once in the materializer and reused by canonical-only verification. Both start with their UTF-8 domain string plus NUL and signed 64-bit little-endian rate/channel fields. `screenrec.capture-pcm.v1` then hashes exact interleaved Float32LE samples. `screenrec.capture-support.v1` adds phase microseconds, then maximal represented run tuples: physical first frame, declared first frame, frame count, each signed 64-bit little-endian. Callback grouping and removed-pause provenance do not split genuinely adjacent native placement. Receipts remain publication-owned.

An existing candidate is never overwritten: the same owner recomputes pinned evidence and validates its complete samples/support before returning facts. Canonical-only verification uses the same mapping and PCM verifier after healthy payload cleanup. Media identity hashing uses positioned reads from regular no-follow files or inherited descriptors and does not disturb the caller's file offset.

`ExactTime` and `AudioSourceReader` moved to Media because Audio and this verifier both consume their native-address semantics. Audio conversion remains in Audio. Decoder phase/selection behavior is unchanged; the added asset constructor argument allows a dense composition while retaining the actual source input's resource loader and errors.

Some integral rates and admitted phases require a container timescale beyond Int32. That refusal is explicit and leaves working media intact. The [prospective clock gate](../20b-container-preflight/README.md) now reuses this exact preflight before accepted phase mutation. Actual writer rollout remains coupled to20d; not every integral rate/phase is materializable.

## Retained evidence

The archive and manifest preserve matched per-run/dense/batched outputs, canceled candidates, phase localization, terminal PCM marker metadata, descriptor relocation controls, test logs and review findings. The final shape review kept one shared materializer/verifier and the existing journal parser. Independent review found presentation-EOF overclaim, returned-length test oracles and missed cancellation during final prefix replay; each was corrected. Shared per-record journal cancellation is coordinated with the publication owner.

The earlier platform feasibility leaf remains historical. Its Movie sample-append failure was localized to the append loop, not proven to the first data buffer; later raw inspection found documented zero-sample drain/empty-media terminal markers. Neither those markers nor export success alone establish physical completeness. No custom MOV writer, DSP, model, live capture, listening or physical-sync claim is introduced.
