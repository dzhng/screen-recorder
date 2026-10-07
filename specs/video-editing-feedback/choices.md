# Implementation choices

User decisions remain binding; this ledger records implementation discretion outside the approved plan.

## Keep multicam source choice separate from synchronization — sound, high confidence

- **When:** slice01 retained multicam source-choice replay.
- **The choice:** store a small immutable recipe that chooses one retained audio
  window and one picture sample from the same named source for each of the nine
  physical selections. The verifier checks the original recording hash, the
  exact PCM window hash and the decoded picture hash, then reports
  `cameraChoice: caller-authored` and `synchronization: not-established`.
- **The gap:** the corpus needed a replayable multicamera behavior checkpoint,
  but the unlike-microphone evidence does not prove that the three recordings
  share a clock or that a camera belongs to the person speaking. Combining
  source selection with a guessed offset would have turned fixture coverage into
  a false synchronization claim.
- **The reach:** later native angle delivery can consume explicit source
  choices while slices20/21 continue to own clock evidence and slices31/32 own
  speaker attribution. The recipe has its own identity so the frozen historical
  synchronization manifest does not need to change.
- **Verdict:** sound. It proves the behavior that the evidence supports and
  keeps unsupported timing and identity claims refused.
- **Confidence:** high.

## Archive caller speaker bindings with package evidence — sound, medium confidence

- **When:** slice32 immutable package replay checkpoint.
- **The choice:** store the generation-scoped `{slot, displayName}` bindings beside
  each exported `speaker-generation` resource, then decorate source and project
  interval rows from that archived list. Managed reads continue to use the live
  `SpeakerLabelStore`; package reads never consult it.
- **The gap:** a package preserved acoustic operands and project mapping but read
  anonymous slots after a caller renamed one. Re-reading the managed store would
  make a read-only package depend on mutable state and could change old evidence.
- **The reach:** package source/project replay now matches the managed labeled
  result while retaining anonymous slots when no binding exists. Scores remain
  unlabelled, and no voice identity or automatic name is inferred. The required
  binding field is a hard-cutover package contract; old package data may be reset.
- **Verdict:** sound for the package replay seam. Selected-range preparation,
  transcript word attribution and long-form continuity still gate slice32.
- **Confidence:** medium; the focused public replay test and core/service builds
  pass, while the ten-minute continuity quality gate remains open.

## Attribute source words only from complete retained turns — sound, medium confidence

- **When:** slice32 source-transcript attribution checkpoint.
- **The choice:** add an optional generation-pinned speaker selector, including
  its explicit audio stream and channel, to a source transcript read. A mixed
  recording can therefore use a speaker-bearing stream without assuming it is
  the transcript stream. For each word, the reader compares its exact source interval
  with retained anonymous speaker turns. One turn that contains the entire word
  yields one slot and its caller binding; no containing turn yields `unknown`, and
  more than one yields `overlap`. A word that merely touches a turn is never
  assigned by nearest time or majority overlap. The continuation carries a digest
  of the caller's bindings so renaming between pages refuses instead of changing
  an already-started view.
- **The gap:** the plan required honest word attribution but did not prescribe the
  join algorithm or how label edits should interact with a paginated read.
- **The reach:** source transcript consumers can render named, anonymous,
  unknown and simultaneous speech without treating camera ownership, energy or a
  diarizer score as identity. Project transcript joins still need the same rule,
  and long-form continuity must still pass before the full labeling slice closes.
- **Verdict:** sound for the source-read seam. It preserves explicit uncertainty
  and gives cursors a stable evidence boundary; it does not overclaim project or
  cross-session identity.
- **Confidence:** medium.

## Compare speaker cursor selectors by meaning — sound, high confidence

- **When:** slice32 source-transcript cursor checkpoint.
- **The choice:** when a caller repeats a speaker selector alongside a transcript
  cursor, compare its stream, optional acquisition, channel, model, generation and
  exact observation endpoints field by field. For example, a cursor created from
  `{ streamId, channel, modelId, observationRange, generation }` can be resumed
  with the same fields written in a different JSON key order. The continuation
  remains valid because the selected evidence is the same; changing any value
  still refuses with `ARTIFACT_CHANGED`.
- **The gap:** the contract required a cursor to pin the speaker evidence but did
  not define how an explicitly repeated selector should be compared. JSON-text
  comparison would treat harmless key reordering as a different request.
- **The reach:** future cursor-bearing operations should compare normalized
  contract fields or a canonical digest rather than incidental serialization
  order. This keeps retries stable without weakening generation or binding pins.
- **Verdict:** sound. The comparison follows the semantic selector identity and
  the focused public journey covers reordered keys.
- **Confidence:** high.

## Split-tone public receipt — sound, high confidence

- **When:** slice25B public delivery checkpoint.
- **The choice:** when a caller imports a `.cube` file and applies it to a chart,
  the receipt drives the same public CLI and MCP operations that a real consumer
  uses. It compares the delivered pixels with a separately calculated
  linear-sRGB curve and reports three fixed rectangles: a grayscale strip, a
  dark colored quadrant and a bright neutral quadrant. A mask is just a named
  rectangle whose measurements are retained; it is not an instruction to grade
  or repair the image.
- **The gap:** the slice required public hue/split-tone proof and color/neutral
  coverage, but did not say whether the existing native LUT probe was enough or
  how to keep those observations independent of the LUT parser. The pass chose a
  generated chart and a small analytic reference so the same source pixels and
  explicit curve are checked through the outer public boundary.
- **The reach:** future curve and color controls can reuse the immutable LUT
  import/execution owner and the receipt shape without adding a second renderer.
  The receipt does not claim moving-shot fidelity or an aesthetic look; those
  remain separate gates.
- **Verdict:** sound. The run isolates the requested transform, preserves source
  and LUT bytes, and keeps measurements from acquiring editorial authority.
- **Confidence:** high.

## Crossfade delivery control — sound, high confidence

- **When:** slice27 native picture checkpoint.
- **The choice:** prove the transition with two tiny caller-authored solid-color
  images. The public edit places them on separate video tracks, applies one
  crossfade window, reads frames before/during/after it, and renders a preview.
  Because the colors are constant, a midpoint containing both colors is direct
  evidence that the delivered pixels came from the two requested clips.
- **The gap:** the slice required rendered samples but did not prescribe a
  fixture. A real-camera clip would add texture and codec variation that could
  hide an opacity or layer-order defect, so the first native checkpoint uses
  deterministic controls and leaves audio and appearance review to their own
  receipts; dip/flash now use the same journey with their own retained controls.
- **The reach:** future transition tests can reuse this public journey to catch
  missing windows, wrong track order or preview/frame divergence without adding
  another renderer. It does not establish an aesthetic grade or audio behavior.
- **Verdict:** sound. The control isolates the transition variable and keeps
  caller-selected media and timing explicit.
- **Confidence:** high.

## Dip and flash delivery control — sound, high confidence

- **When:** slice27 native picture checkpoint.
- **The choice:** reuse the public transition journey with one held red image and
  one black project canvas for each pulse. Read frames before, at and after the
  caller's 250–750ms window, then render the same revision through preview. The
  outside samples stay red and the midpoint reaches the black canvas, so native
  delivery proves the three-point opacity pulse rather than only the authored keys.
- **The gap:** the composition contract leaves the visible dip/flash color to the
  canvas or caller-selected overlay. A black canvas is deterministic and keeps the
  picture variable isolated; it does not claim that every future background or
  audio treatment has been verified.
- **The reach:** future transition receipts can use the same control to catch a
  missing midpoint, wrong window or preview/frame divergence. Audio transition and
  visual-reference acceptance remain independent.
- **Verdict:** sound. The check proves the declared picture behavior without
  inventing a color or an editorial effect.
- **Confidence:** high.

## Keep the half-float Core Image working format after the moving parity probe — sound, high confidence

- **When:** slices27–29 moving reference-parity investigation.
- **The choice:** retain `CIFormat.RGBAh` in the production picture executor after
  rebuilding the worker with `CIFormat.RGBAf` and replaying the public moving
  transition delivery. The three probe PNGs were byte-identical to the retained
  candidate and kept the same one-code-value mismatch against the independent
  linear-light oracle.
- **The gap:** the strict parity failure could have come from the native working
  precision, but changing the format alone did not change the delivered pixels.
- **The reach:** no renderer behavior or gate tolerance changes. The frozen
  reference-parity report remains the owner of the unresolved result, and the
  probe receipt records the exact worker/artifact identities for later diagnosis.
- **Verdict:** sound. The experiment rules out this single precision setting as
  the fix without weakening the zero-difference acceptance rule.
- **Confidence:** high.

## Lexical prerequisite checkpoint — sound, high confidence

- When: slice20 isolated-microphone lexical scout.
- Choice: recognize the existing short audio inputs before spending on word
  alignment. For example, Graham's window contains a paragraph while Madison's
  corresponding window contains no recognized words. A supplied Graham paragraph
  could still force a conditional path through Madison's signal; it cannot prove
  Madison's microphone heard that paragraph. This pass retains both independent
  observations, refuses their shared-speech prerequisite and performs no timing
  inference. It does not declare the whole recordings unsynchronizable.
- Gap: the spec assigned lexical research without prescribing the cheapest
  staged experiment or what to do when shared content is unavailable locally.
- Reach: the next pass needs an actual shared mixed/reference bridge or another
  independently evidenced signal. The failed scout remains replayable, and no
  public relationship, edit or provider contract changes.
- Verdict: sound. Refuse missing evidence rather than let supplied text create
  it. The protocol's prospective coarse CTC measurements are not a substitute
  for the original125ms/maximum2ms promotion control or long-span/drift refusals.
- Confidence: high. Preparation, source integrity and no inferred editorial
  decision follow the user's explicit direction and the product boundary.

## Preparation boundary — sound, high confidence

The user clarified that pinned models for first-class Yap features, specifically Parakeet, should download/prepare as needed by default. The recommendation-only policy applies to capabilities outside Yap. Preparation remains an explicit operation through the existing model owner; ordinary inference stays offline. This supersedes the broader wording in the original plan.

## Contextual join report — sound, high confidence

- **When:** slice12B public `join.verify` pass.
- **The choice:** make the report a read-only composition of already-published evidence. When an agent asks about a boundary, the service checks the pinned revision and prepared tap, reads exact source/project sides, and optionally reads retained alignment or rendered recognition. It never starts Parakeet, alignment, speaker labeling, rendering or an edit. Missing evidence is returned as missing, and phonetic completeness stays unknown.
- **The gap:** the slice required a public report but did not prescribe whether the endpoint could prepare evidence as a convenience. The implementation chose the existing preparation owners and kept review synchronous and observational.
- **The reach:** future repair work must request padded preparation and then call the report explicitly; it cannot hide model work or editorial decisions inside verification.
- **Verdict:** sound. The boundary preserves the product rule that detection supplies evidence and explicit edits supply treatment.
- **Confidence:** high.

## Prepared-audio evidence safety — sound, high confidence

- **When:** slice12B audio evidence pass.
- **The choice:** use the shared exact sample clock and an identity-bound prepared-file lease. If the requested project window quantizes to no sample, or overlaps unavailable prepared PCM, the report refuses explicitly instead of returning a zero-length or zero-filled signal as if it were measured. Waveform and spectrum readers share the request cancellation signal and a bounded spectral hop.
- **The gap:** the report needed physical acoustic evidence, but the slice did not spell out how to handle fractional sample windows, source gaps or a client that disconnects mid-read. The implementation reused `sampleAt`, `PreparedAudioStore.open` and the existing bounded readers.
- **The reach:** later repair and candidate comparison can trust that an observed waveform belongs to the pinned bytes and that unavailable or cancelled work is not silently promoted to evidence.
- **Verdict:** sound. The decision follows the existing ownership and refusal contracts rather than adding a second audio clock or storage authority.
- **Confidence:** high.

## Report shape and evidence examples — sound, medium confidence

- **When:** slice12B documentation closeout.
- **The choice:** retain a compact example response and a verification receipt beside the contextual-join evidence. The example demonstrates observed, missing and unknown states without pretending to be a live ASR or phonetic certificate; the receipt records the real focused test command and independent verdict.
- **The gap:** the spec asked for durable evidence but did not choose between copying a full media report and documenting the public shape. The implementation chose a small shape example plus the executable test receipt so generated waveform and model output do not become a second fixture source.
- **The reach:** future slices can point at one public report contract and one receipt while keeping raw media and model operands with their existing owners.
- **Verdict:** sound. It keeps documentation useful without duplicating code-discoverable rosters or inventing a second evidence database.
- **Confidence:** medium-high for caller-authored delivery; medium for global synchronization.

## Exact-removal verification boundary — sound, high confidence

The pass exercises persisted project transactions, restart, replay and undo with independent probe controls. This proves exact authoring and storage without claiming decoded-media quality; slice34 owns the final real-media gate. No downstream clock rule changed.

## Capability examples and provenance controls — sound, high confidence

Runnable examples consume IDs from saved public revision replies and retain continuation pins. Controlled old-installed and current-source skill folders remain distinct, so freshness is proved instead of inferred. The portable checkpoint uses available Node24.21; bundled runtime/native readiness remains explicitly unverified until the final installed-runtime gate.

## Native-decoder audio fixture recipe — sound, high confidence

Retain source-rate Float32 rather than compress or resample the first audio excerpts. Derive through the existing native source-audio owner and compare re-decoded retained samples against the original decoder operand. This keeps codec admission, physical sample counting and clock arithmetic with their existing owners. The 28MB inputs leave ample corpus budget. Numerical equality does not establish ASR equivalence or prove that an old failure survives; those verdicts remain separately pending.

## Publication generation identity — sound, high confidence

When an earlier transcript or index remains readable while a replacement runs,
the reply identifies both the work now running and the retained output. The
retained publication uses its owner's actual generation, which may be a number
or a nonempty index-attempt string; it never invents a numeric generation.
Slice03 left that representation unspecified. Keeping actual identities lets
future waiting and cache consumers tell replacement work from readable old
output without a second mapping table. This choice landed in `5d56d2f4`.

## Historical operand boundary — sound, high confidence

A saved receipt predating the public cutover still has its original fields.
Historical comparison tools read that one frozen shape; current callers read
the new public envelope. Converting archived receipts would destroy the original
comparison operand, while accepting both in production would violate the hard
cutover. Slice03 required archive preservation without prescribing fixture
construction. Fixture-local extraction preserves both obligations and does not
introduce a production compatibility reader. This choice landed in `5d56d2f4`.

## Speech timing choices — landed in `6b948f83`

Review first: refusing a result whose delayed punctuation exceeds selected physical support is conservative and can reject otherwise legible words. The parent approved this boundary; a wider explicit selection is a future caller remedy, not silent repair.

### Sound, medium confidence

#### Refuse invalid raw operands as a complete result

- When: slice07 implementation pass.
- Choice: if an engine token contains a nonfinite, reversed or out-of-selected-support estimate, the operation fails nonretryably instead of editing the estimate or publishing only the remaining words. For example, a sentence can have speech-bearing tokens inside the selected audio but delayed punctuation outside it. This still refuses; punctuation is an estimate, not a claim about the last audible sound.
- Gap: the plan allows diagnostics/refusals but did not choose partial publication versus refusal. The current native wire has one bounded code/message/retryable failure and no per-word diagnostic publication contract.
- Reach: callers may explicitly request wider source context; they cannot receive secretly clamped or silently dropped words. Public failures preserve offending indexes, timing/confidence and support context. Invalid fixture inputs retain complete operands in the evidence; no full live engine-result failure artifact is published by this slice. Successful raw results remain intact.
- Verdict: sound conservative boundary, approved by the parent. It avoids inventing another publication contract. Real tiny/25-second cases pass, but do not establish that every end-of-selection punctuation estimate fits.
- Confidence: medium that this is the user's preferred conservative tradeoff; high that it implements the approved plan.

#### Isolate raw-observation replay from media acquisition

- When: slice07 retained checkpoint.
- Choice: the case-selected replay reads hash-pinned native JSON, indexes it in owned scratch and verifies every word through one-row pagination. It deliberately does not import fake media metadata or re-run the model; the native runs and fixture provenance separately establish source/input identity.
- Gap: the plan requires a runnable checkpoint but leaves its construction open. Full repeated imports and inference would test different owners and cost much more than the indexing question needs.
- Reach: this checkpoint proves raw admission and traversal, not authenticated source ownership, model loading, accuracy, or the complete public CLI journey. Existing core owner tests exercise real asset admission separately.
- Verdict: sound, because the report names its scope and keeps the independent native/source evidence alongside it.
- Confidence: medium.

## Picture certification scope — sound, medium confidence

When reducing a camera excerpt, keep the complete raster and the original warm
lighting, backlit highlights and framing. This pass retains ProRes SQ video-only
inputs rather than shrinking or grading them. The reduction recipe is delegated
by slice01; the extra choice is to keep decoded-frame support and sampled visual
fidelity as separate acceptance records. Every decoded frame's dimensions, color
metadata and timestamp are checked, while four matched source/derivative frame
pairs per camera establish the narrower visual claim. A fresh critic also checks
complete contact sheets and face crops. This does not assert that every intermediate
frame was visually inspected, and later picture primitives still need their own
behavioral gates. The alternative would hide source defects or imply exhaustive
visual proof from a hash. Future fixtures must state their own preservation scope.

## New video derivation requires independent admission — sound, high confidence

A caller can regenerate a selected clip with the frozen, hash-pinned encoder
recipe. The tool checks physical raster and frame timing, but writes its visual
preservation status as unverified. It refuses corpus certification until a separate
source comparison is recorded. Slice01 did not specify whether regeneration alone
should declare quality passed. Keeping that boundary prevents a newly generated
file from certifying its own appearance; matched bytes on a selected regeneration
are retained as additional evidence, without a second quality judge in product code.

## Speaker research resource boundary — sound, medium confidence

- When: retained slice31 research and maintenance checkpoint.
- Choice: report the inference process's peak resident memory as the measured
  resource bound. When a CoreML trial finishes, this reports memory attributed to
  that process; system model caches and separate accelerator services can hold
  additional memory. It does not claim a bound for the entire Mac.
- Gap: the planned memory gate did not identify which operating-system accounting
  boundary to use. The trial measurements supply process RSS (resident memory),
  while whole-system memory would require a separate controlled comparison.
- Reach: these trials can establish their stated process cost, but a future packaged
  provider must name its resource boundary and cannot inherit a total-memory claim.
- Verdict: sound as a scoped research measurement. No failed provider or broader
  memory claim is promoted. A distribution needing a total-machine bound requires
  its own measurement before that claim becomes public.
- Confidence: medium.

## Recovered runtime has a new identity — sound, high confidence

- When: retained original speaker replication.
- Choice: reconstruct missing dependencies through the existing preparation owner
  and give that complete artifact a new hash. For example, a rebuilt dependency
  library can preserve the speaker calculation while changing runtime bytes; exact
  matched calculations prove that scoped behavior, not identical installation.
- Gap: the historical runtime was gone, and the plan required preserving its
  computation without specifying how to identify a rebuilt dependency closure.
- Reach: future packaging must pin the actual complete prepared artifact. The
  private trial does not change the default registered runtime or reuse its old
  digest; Nemotron source layers likewise remain separate from their base runtime.
- Verdict: sound. Hashes describe actual bytes, and matched original outputs remain
  a separate preservation record rather than a substitute runtime identity.
- Confidence: high.

## Bounded alignment reference decisions — integrated d49a2259

## Sound — medium confidence

**Treat matched as observed provider correspondence.** When supplied text says
privacy and greedy CTC says prophey, retain privacy as unmatched and prophey as
an extra observation; a successful forced path never upgrades privacy to a fact.
When both strings say blue, a unique ordered occurrence may be matched while its
forced timing stays conditional. The plan left the meaning of matched/unmatched
underspecified; root approved this bounded interpretation before cached admission.
It lets10 expose useful evidence without a fake confidence number or a promise
of independent lexical truth. Future callers must see the interpretation rather
than treat matched as a verified transcript.

**Use isolated generated utterance placement as mechanical controls.** Blue,
seven and blue were requested separately and planted at known sample offsets.
This can disprove an aligner that places seven far from its actual source clip;
it does not certify connected-speech word/phoneme boundaries. The research plan
requested independent controls without requiring a human labeler. The choice
keeps fixture truth narrow and leaves partial phonetic identity unknown.

**Retain normalized bounded PCM as numerical research operands.** Full matrices,
path arrays and the selected tiny/25s prepared PCM make the failed and accepted
reference independently replayable without reacquiring original media or models.
Compressed numerical operands remain feature-owned spec evidence, while raw
reusable media belongs to fixture ownership. Parent requested LFS and no weights,
runtime/build copies or raw-source replication. This costs about18MB of LFS data
and no additional production dependency.

## Sound — high confidence

**Never pick a convenient repeated-word tie.** If supplied text has two final
blue occurrences but native greedy text has one, all optimal ordered sequence
correspondences can pair either occurrence. Both supplied occurrences stay
unknown. Choosing the first or the nearest by timestamp would silently invent
an occurrence decision. The plan demanded repeated/missing/extra evidence but
not the tie rule; root approved all-optimal occurrence matching, consistent with
08's native window matcher. Production10 must share that arithmetic owner.

**Refuse token cells crossing physical source support without clipping clocks.**
The original model emits .08s cells and can include a final partly unsupported
cell. If a conditional token ends .4s but PCM ends .391375s, retain the full native
path and separately refuse that operand's timing support. Shortening .4s to the
PCM end would conceal uncertainty. This is evidence admission, not a claim the
model is unusable in valid context; root explicitly accepted this distinction.

**Reuse the prepared research runtime without declaring a new product runtime.**
The original checkpoint strict-restores in pinned NeMo/Torch already prepared
for speaker research. Its ready weights and successful inference do not establish
a first-class bounded transcription runtime install or closure for10. No engine
registration, app data, consumer install or model binary ships in09. The plan
permits existing prepared runtimes; future10 still owns preparation and parity.

Candidate selection and exact CTC head/clock/score preservation were explicitly
delegated by09 and are recorded in the accepted reference rather than invented
product policies. Original NeMo protocol inherited Fluid-only descriptive fields;
accepted-recipe interpretation corrects their meaning while preserving historical
bytes, actual worker/preprocessing and all measured operands.

## Valid measurements survive unrelated setup failure — sound, medium confidence

- When: decoded-picture reference checkpoint.
- Choice: retain four completed camera/chart cases from a run whose fifth orientation
  control was prepared incorrectly, then pair those valid measurements with a corrected
  orientation-only run. For example, the Graham source/project/player pictures and
  exact physical clocks passed before an unrotated control failed its expected raster;
  that preparation failure does not invalidate Graham's unchanged input or pixels.
  The failed whole-run report remains failed and visible. Acceptance states exactly
  which case records are used, and the durable runner can reproduce them together.
- Gap: the plan did not say whether an unrelated final control setup failure requires
  repeating valid prior expensive measurements. The repo requires reusing valid results.
- Reach: future research may aggregate independently valid bounded observations only
  with unchanged operands/recipes and visible failures; it cannot relabel a failed run
  as a complete pass or inherit unmeasured temporal/HDR claims.
- Verdict: sound. It saves redundant media work while preserving the narrower proof.
- Confidence: medium.

## Retain representative PNGs beside complete sample receipts — sound, medium confidence

- When: decoded-picture reference checkpoint.
- Choice: retain one complete player/source/project/diagnostic frame per case plus
  supplementary montages; keep all sampled clocks, actual profiles, metrics and image
  hashes in frozen reports. A future agent can inspect these representative full-size
  files without downloading another large picture bank; reproducing other sampled
  pixels uses the durable runner and existing camera/chart fixture owners.
- Gap: the plan required reproducible evidence under a small media footprint but did
  not prescribe how many inspection PNGs must stay in Git.
- Reach: retained receipt replay proves its clock/profile/metric and file-integrity
  scope; it explicitly does not remeasure unretained pixels. The fresh visual critic
  received the complete captured set, so selected retention did not select the verdict.
- Verdict: sound as declared sampled evidence, with no exhaustive playback claim.
- Confidence: medium.

## Bounded speech decisions — integrated34a21754

These are decisions made in gaps in the original slice, approved by the integrator
while implementing. Recipe sizing was explicitly delegated and is recorded with
its measured evidence rather than treated as an invented decision.

## Sound — medium confidence

### Shared context establishes occurrence correspondence through mandatory word order

When two decodes report the same word on opposite 80ms frames, their estimated
intervals can touch without overlapping. Rejecting this pair solely on overlap
loses a valid preparation; accepting the nearest timestamp would invent a tolerance.
The work instead compares word sequences inside their exact shared decoded support.
A guarded word must pair with the same peer in every longest ordered matching
sequence. Missing or repeated ambiguous matches refuse; true points require equal
point estimates. Selected text, confidence and times remain the original observation.

The original slice required boundary agreement without specifying correspondence.
This decision constrains subsequent alignment reuse: the generic sequence certainty
can be shared, while source support, points and ownership remain speech policy.
It is sound because uncertainty stays explicit and no timestamp becomes a repair;
confidence is medium because this evidence establishes correspondence, not audible truth.

### Conflicting start ownership keeps one original observation deterministically

A seam at 20s can have a left word starting 19.95s and a right peer starting 20.03s,
so both decodes provisionally own it. The opposite shift can leave neither owning
it. Once ordered correspondence is uniquely established, the work retains the
original single owner if there is one; when both or neither own, it retains the
left observation once. It does not average, clamp or change estimates.

The plan required no duplicates or lost seam occurrences without selecting an
estimate on conflicting starts. This deterministic rule lets retained preparations
remain reproducible and keeps raw alternatives inspectable. It is sound for an
evidence primitive; confidence is medium because neither estimate is proved more
accurate and the policy deliberately makes no such claim.

## Sound — high confidence

### Phrase continuity follows connected primary observations

A phrase whose first word crosses 20s and whose second begins 20.2s should remain
searchable when inference merely used two windows. Words therefore share a phrase
run when transcribed primary ownership touches exactly. A skipped interval or real
unowned/missing support starts a new run. Each native window ordinal is also stored
privately, so portable receipts still count each window's words independently.

The old source search treated every inference segment as a phrase barrier; the
slice did not choose how bounded windows should affect it. This change prevents
window size from changing ordinary source phrase semantics. It is sound because
only continuous observed ownership joins, and original estimates remain unchanged.

### Native readable support is retained separately from ownership

For a request owning 18–22s with context 16–24s in a 25s source, the source outside
primary ownership was not transcribed, but it still physically exists. The receipt
retains actual readable 0–25s support separately from 18–22s primary ownership and
16–24s decoded support. Reads distinguish `not_observed` from `not_acquired` using
those retained facts; packages preserve them after the original runtime disappears.

The original slice distinguished gaps but did not name the native support echo
needed to preserve physically narrowed source facts. This adds one required retained
input, with strict execution/ownership receipts and a hard format cutover. It is
sound because masking bounded decode work cannot relabel existing media as missing.

## Selected corpus speech decisions — integratedfd0401d0

These are the choices made during the three-case pass. The parent owns the permanent ledger and global handoff. Frozen07 execution, exact token/word parity rather than lexical ground truth, six bounded calls, preserved historical failures, network-denied inference and no root-build/model/original mutation were explicit assignment constraints.

## Sound — medium confidence

### Preserve the pre-run source hash with a narrowly described post-run observation

- When: selected speech parity pass at source9368acc.
- Choice: Before inference, hash both complete multi-GB originals and each selected derivative. Afterwards, rehash the small derivatives and the executable/source pins, and check original file size and modification time. The final receipt says exactly which checks ran. It does not claim that a second original hash was computed. Rehashing every original after these read-only operations would cost work without evidence of a writer.
- Gap: The assignment requested source/model closure scope after execution without redundant expensive reruns, but did not prescribe the last check.
- Reach: A future pass that writes an original, observes changed metadata, or sees evidence of another writer must re-establish byte identity. This narrow observation cannot substitute for such a check.
- Verdict: sound; no operation in the pass writes an original, all six native requests read bounded source intervals, and the limit of the metadata observation is explicit.
- Confidence: medium; the source-preservation principle supports this tradeoff, but post-run metadata alone is intentionally weaker than a second complete hash.

## Sound — high confidence

### Compare every native raw field except per-call processing time

- When: selected speech parity comparison.
- Choice: If the original and derivative recognize the same words, compare their complete native raw records after subtracting only the original source origin. Keep source support, token confidence, token times, word recognition/spoken times, sample counts and ASR duration. Exclude only processingTime because otherwise two equivalent decodes would fail due to how long the computer took. Preserve that time in both untouched raw outputs and the comparison receipt. There is no tolerance or text cleanup.
- Gap: The protocol specified exact token/word parity and allowed documented incidental duration exclusions; it did not specify a complete raw-record equality check or canonical hash encoding.
- Reach: Future comparisons can detect an unexpected field difference instead of silently checking only a selected subset. A new incidental field requires explicit reasoning rather than automatic omission.
- Verdict: sound; equality is stronger than the required observation operands, and the single exclusion cannot hide recognition differences.
- Confidence: high.

### Build the frozen owner in isolated output rather than use an unrelated executable

- When: preparation before native inference.
- Choice: The root binary was the old baseline, and the other agent's once-valid07 binary had been rebuilt with unintegrated08 speech windows. Build native at the integrated07 source revision in fresh scratch, using symlinks to unchanged pinned SDK/denoiser inputs. Do not share mutable build products or claim an08 binary proves07 behavior. The failed root-traits invocation is preserved, then corrected according to the existing root manifest; it never invoked inference.
- Gap: The required implementation was clear, but no valid executable of that frozen revision remained available.
- Reach: Every raw observation now identifies the actual isolated executable and source revision. Later08 output needs its own requests and receipts, even if its result happens to agree.
- Verdict: sound; it preserves one product speech owner and separates runtime identity without copying dependencies or mutating the root build.
- Confidence: high.

No unsound or needs-user choice was found. Evidence filenames, compact ordinary Git JSON/text storage and scratch-only resource sampling are internal discretion. Resource claims retain native-reported process peak memory separately from sampled RSS, and fresh processes with OS caches are never described as a warm resident worker.

## Historical caller verification boundary — sound, high confidence

- When:08 root caller cutover.
- Choice: Short, unchanged whole-support speech inputs compare every historical raw
  operand after validating new ownership and candidate metadata. Measured processing
  time is excluded; longer/context inputs cannot use this comparison. For example,
  the old6s observation and new6s observation must retain all words/tokens/times,
  while a25s input processed in multiple windows needs its own accepted recipe proof.
- Gap: the hard cutover invalidates historical raw admission without specifying how
  to keep historical reference comparisons useful.
- Reach: frozen evidence stays intact; only explicitly labeled reference derivatives
  gain modern provenance. No production compatibility reader or accuracy relaxation.
- Verdict: sound; contract additions are checked rather than silently discarded.
- Confidence: high.

## Bounded delivery owner decisions — integrated148a7b11

All six choices below are sound, high confidence;04 left these arrangements
unspecified. They preserve the existing owners rather than adding new schedulers.

- **Measurement JSON uses cache-backed leases.** When a measurement becomes ready,
  CLI reads identified chunks and closes its lease. Opening a private service-cache
  path would bypass the same lifetime used by other media; future evidence delivery
  inherits the public lease contract.
- **Single and batch artifacts share atomic publication.** If writing the first
  frame fails halfway, its final filename stays absent while a later sibling can
  succeed.04 did not explicitly name the batch path; both paths now use the same
  staged validation and no-overwrite owner.
- **Initial getters observe themselves and pin completed attempts.** If
  `transcript.get` starts pending and later returns a page without a job ID, the page
  still has to match the earlier observed attempt. The alternative would accept a
  replacement page simply because it said ready. This constrains all waited reads.
- **Export recovery is current work; the first receipt is history.** If original
  publication failed and reconciliation is queued, waiting follows the reconciliation
  job and returns the export's destination/history. A later failure stays a failure
  even if an older committed file exists. Generic job replacement would erase domain
  meaning, so export reads refresh and reinspect the current attempt.
- **Package waiting observes its existing process-local admission.** A returned
  `data.id` is passed as `admissionId` to `package.status`; the private context-job ID
  cannot be inspected through public `job.get`. If the service restarts and that
  admission disappears, waiting retains the acknowledgement and reports interruption.
  It never opens the package again or claims rollback/durability.
- **JSON disk validation and MCP buffering retain different bounds.** A producer's
  valid JSON up to16MiB can be atomically delivered to disk; model-facing MCP buffering
  retains its existing4MiB limit.04 required validation without selecting a memory
  policy. Reusing each consumer's established budget avoids a new universal limit.

## Slice17 — complete tap preparation

### Sound decisions

- **Preparing a selected signal uses the existing whole-program duration.** A clip,
  track, group or intermediate step uses the same tap selection and processing-state
  domains as ordinary inspection; the request adds no arbitrary excerpt normalization
  contract. This follows the compiler's existing semantics and keeps history/retry
  identity literal. The public help states complete domains; dynamic feasibility still
  requires actual execution. No separate duration policy or scheduler was added.
- **Only the prepared final mix may replace movie audio.** Dry and intermediate
  preparations remain useful evidence but cannot silently become the delivered soundtrack.
  Recorded tap and ordered recipe bind retained resolution and portable adoption;
  omission still means processed output. The public native export test borrows that
  retained mix and forbids audio recomputation during picture encoding.
- **Preflight preserves the existing export order.** The movie owner already prepares
  complete audio and checks strict normalization before encoding pictures. The pass
  adds an externally observable refusal regression rather than another execution path
  or diagnostic store. Existing job failures retain measured reasons; edit admission
  remains cheap and no loudness tolerance changes.

## Slice18 — normalization evidence and retained selection

### Sound — medium confidence

- **Record every attempt and the delivered attempt explicitly.** When three
  normalization candidates measure −14.9, −14.7 and −14.6 LUFS, the retained
  result stores all three offsets/measurements and `selectedAttempt:2`. If the
  second candidate gets worse, the result can instead select the first admitted
  candidate while retaining both observations. The alternative, storing only the
  final measurement, would conceal the work and could imply that the last tried
  PCM was delivered.
  Gap:18 required iteration operands but did not choose a canonical stored shape.
  Reach: prepared audio, publication and portable packages share this shape;
  catalog29/package6 refuse old incomplete records under the authorized cutover.
  Verdict: sound; the selected measurement is checked against the published
  measurement without introducing another evidence store. Confidence: medium.

### Sound — high confidence

- **Keep admitted PCM through nested existing artifact lifetimes.** If an
  already acceptable candidate is followed by a worse correction, its open held
  file remains available until the correction settles, and downstream processing
  consumes that file. The alternative would copy the candidate into a new
  retention owner or fail despite an already acceptable result. Gap: the spec
  did not prescribe how candidate selection would preserve file lifetime.
  Reach: correction reuses the existing bounded attempt owner; cancellation and
  IO failures still fail rather than silently publish stale output. Verdict:
  sound; one artifact owner preserves the original source and the selected
  output. Confidence: high.
- **Charge bounded traversals to the existing audio deadline.** A dynamic
  request may scan twice and render/measure up to three candidates. Its existing
  frame-based scheduling budget now accounts for eight traversals, while reads
  using retained final audio skip them. The alternative, a constant timeout bump,
  would overcharge short reads and undercharge longer source domains. Gap:18
  fixed work limits but not scheduler accounting. Reach: the existing capped
  deadline owner remains shared by preparation and rendering. Verdict: sound;
  cost follows complete domain duration and the one candidate-count policy.
  Confidence: high.

The correction constants and original-input recipe were explicitly delegated to
replication, so their frozen measured selection is not an invented policy choice.
No unsound or needs-user decision remains in this pass.

## Slice05 — atomic replacement

### Cooperative ownership and truthful external conflict

- **When:** slice05.
- **Choice:** serialize Yap publishers by the destination directory, and retain
  every unexpected displaced entry after an external race. Suppose Yap pins the
  current output, then another same-user program replaces it immediately before
  the kernel swap. macOS cannot condition that swap on the expected file identity
  or digest. Yap can therefore publish its new file while discovering afterward
  that it displaced unknown bytes. It reports a conflict with uncertain visibility
  and retains the unknown entry. Recovery never swaps backward over a possible
  newer output. A raced symlink is swapped as a link; its referent stays intact.
  The alternative rollback could destroy a successor. This boundary was frozen
  with parent approval after exercising the actual syscall.
- **Gap:** the original atomic-replacement brief did not specify guarantees
  against external writers that ignore ownership or the OS's final-symlink rule.
- **Reach:** all replacement consumers inherit cooperative serialization and the
  explicit external-race limitation; unknown displacement can block cleanup.
- **Verdict:** sound; truthful retained conflict is the guarantee the OS permits.
- **Confidence:** medium; this is a material platform tradeoff, not universal CAS.

### Trust exact live bytes through existing receipts

- **When:** slice05.
- **Choice:** a destination is trusted only if its directory, leaf, device/inode,
  length and SHA-256 match an existing recorded publication receipt. If a person
  edits the output in place or puts identical bytes in another file, the new
  export treats it as foreign and needs explicit overwrite. An index on existing
  export records makes that lookup bounded by the selection rather than scanning
  history. The alternative trusting the name or a formerly owned inode would
  replace modifications that Yap did not produce.
- **Gap:** the brief named trusted ownership but not its persisted lookup.
- **Reach:** receipt retention supplies future replacement trust; deleting the
  owning intent removes that trust rather than creating a separate ownership DB.
- **Verdict:** sound; existing publication evidence stays the one owner.
- **Confidence:** high.

### Imported original identity belongs to the asset owner

- **When:** slice05.
- **Choice:** the asset store indexes the device/inode recorded when an original
  was imported. If the person renames that original or hardlinks it as another
  output leaf, overwrite still refuses it. Service maps native identity names
  into the existing asset file-identity names at this boundary. It checks again
  before commit so an import admitted during preparation is protected too. A
  path-only blacklist would miss the renamed/aliased original.
- **Gap:** source preservation did not name an original-identity query owner.
- **Reach:** import records own external-original protection; no second source
  registry or adapter-specific blacklist is introduced.
- **Verdict:** sound; identity protection follows the current durable owner.
- **Confidence:** high.

### Explicit overwrite participates in replay identity

- **When:** slice05.
- **Choice:** omitted and false overwrite both mean no foreign replacement;
  true is distinct in the existing request replay key. Suppose an uncertain
  export is replayed with the same exportId but now allows foreign replacement.
  That is a different authorization, so it refuses as REQUEST_CONFLICT instead
  of treating it as the earlier request. Native prepared receipts require an
  explicit replacement field, including null for absence; old receipt formats
  are not translated.
- **Gap:** the opt-in brief did not define normalization in durable replay.
- **Reach:** CLI/app/shared protocol consumers agree on authorization meaning;
  this is the authorized hard cutover, with no reader shim or migration.
- **Verdict:** sound; recovery cannot silently widen the original request.
- **Confidence:** high.

### Confirmed evidence survives interrupted cleanup

- **When:** slice05.
- **Choice:** after validating the displaced file, native hardlinks its prepared
  receipt as committed evidence. Suppose acknowledgement cleanup removes the
  old leaf, payload and prepared receipt, then the publisher dies before removing
  that last marker. Recovery can still identify the exact new output and finish
  cleanup without publishing it again. Without that marker the missing old leaf
  would be indistinguishable from unconfirmed displacement. Storage counts the
  receipt's shared inode once and counts the retained old bytes separately. A
  retained swap symlink contributes its own no-follow metadata length, so normal
  storage reads remain available without measuring or traversing its referent.
  Existing job conflict details still distinguish it from an owned payload.
- **Gap:** the brief required crash recovery but did not specify partial-cleanup
  evidence or hardlink storage accounting.
- **Reach:** the existing staging lifetime owns the marker; no janitor or new
  publication database is needed.
- **Verdict:** sound; it preserves one receipt through the cleanup transition.
- **Confidence:** high.

### Publication proof isolates unrelated media work

- **When:** slice05.
- **Choice:** compile the real publication, held-storage and worker-lifetime
  sources into a small scratch executable. Public CLI tests export plain captions
  against the real service while substituting only font probe metadata and
  render-workspace disposal. The fault library interposes the actual swap and
  can kill the real native publisher before or after it. This yields filesystem
  and public-contract proof without rebuilding codecs or downloading models;
  the alternative full media fixture would add work unrelated to publication.
- **Gap:** the checkpoint did not mandate a native build recipe.
- **Reach:** these tests certify their named publication contracts only; parent
  still runs the full feature gate. No capture or rendered-quality claim follows.
- **Verdict:** sound; narrow real owners provide fast, meaningful evidence.
- **Confidence:** high.

### Hashing budget includes the pinned victim

- **When:** slice05 closeout.
- **Choice:** extend the existing deadline helper with the old destination's byte
  length, budgeting the native payload and victim verification passes under the
  established worker maximum. Suppose a tiny caption export replaces a large
  explicitly authorized file: hashing that victim is real work even though the
  new payload is small. A payload-only deadline would cancel valid replacement
  work. The cap stays authoritative; no unbounded wait or different timeout
  owner is introduced.
- **Gap:** the existing heuristic predated replacement hashing.
- **Reach:** all export kinds budget pinned file validation through one helper.
- **Verdict:** sound; cost follows actual admitted work and remains capped.
- **Confidence:** high.

## Slice10A — pinned alignment preparation

### Reconstruct the optional runtime from pinned public inputs

- **When:** slice10, provider checkpoint A.
- **The choice:** When a fresh consumer requests alignment model preparation, the
  existing Models owner acquires a pinned public Python archive and package
  inputs, then assembles the runtime offline. It checks every resulting file,
  mode and contained link before marking it ready. Publishing a prebuilt private
  archive would avoid assembly time but create another distribution artifact and
  currently requires external publication the session did not authorize.
- **The gap:** The frozen recipe identified a working local donor; it did not
  identify a consumer acquisition route or a published runtime archive.
- **The reach:** The repository now owns one curated reconstruction recipe and
  measured inventory. Package changes require an explicit new inventory and
  provider parity rather than dependency resolution at execution time.
- **Verdict:** sound. It reuses acquisition, hashing, cancellation, readiness and
  process owners; fresh preparation has reproduced the complete reference.
- **Confidence:** medium. A future signed prebuilt artifact could reduce
  preparation cost, while preserving those same admission contracts.

### Remove selected native search commands without developer tools

- **When:** slice10, provider checkpoint A.
- **The choice:** Some wheel libraries contain search paths belonging to their
  builders. The assembled clone removes only the exact declared ARM64 search
  commands, keeps occupied sections and dependency names intact, and re-signs
  through the operating system. Requiring the developer command-line tools would
  prevent a clean consumer Mac from preparing the model.
- **The gap:** The accepted experiment used a developer tool to edit these paths;
  the consumer recipe must work without that prerequisite.
- **The reach:** Native packaging owns a bounded parser and mutation operation,
  with before/final operands. Unsupported binary shapes refuse rather than being
  heuristically rewritten.
- **Verdict:** sound. All affected outputs match the previous method byte for
  byte, and the parser has independent refusal/movement controls.
- **Confidence:** high.

### Normalize installer metadata into public provenance

- **When:** slice10, provider checkpoint A.
- **The choice:** Installing the same wheel in two scratch folders can otherwise
  produce different metadata because pip records a private file URL and hashes
  discarded console wrappers whose first line names the scratch interpreter.
  The recipe stores the pinned public URL/hash and removes only records for
  those absent wrappers. It retains package computational files and metadata
  lookup order. Keeping the private URL would make an inventory impossible to
  reproduce on a fresh computer.
- **The gap:** The frozen donor closure did not prescribe reproducible installer
  provenance for new consumer folders.
- **The reach:** Readiness remains tied to exact resulting bytes. Private staging
  paths cannot silently enter runtime identity; the runtime still has its own
  digest distinct from the donor's.
- **Verdict:** sound. Two different private roots produce identical admitted
  metadata, and actual inference retains exact reference outputs.
- **Confidence:** high.

### Share ordered correspondence arithmetic while keeping admission separate

- **When:** slice10, provider checkpoint A.
- **The choice:** Both speech seam reconciliation and supplied-text comparison
  ask which ordered word pairs occur in any optimal correspondence. They use
  one native arithmetic owner that retains all possible pairs and omissions.
  Each caller still decides text folding, point ownership and physical support.
  Choosing one tied path would invent a certainty the observations do not have.
- **The gap:** The two accepted workflows had equivalent arithmetic with
  different interpretation policies.
- **The reach:** Future callers can reuse pair arithmetic without inheriting a
  transcript clock or word-admission rule.
- **Verdict:** sound. Frozen complete pair/omission operands match through the
  production wire, and existing speech seams remain unchanged.
- **Confidence:** high.

## Slice14 — delivered picture measurements

### Sound — medium confidence

- **Measure color only on fully opaque delivered pixels.** A half-transparent
  red foreground has premultiplied byte values that can resemble a dark red.
  The receipt counts those pixels separately instead of claiming an exposure
  value; no opaque pixels yields unavailable color. Gap: the slice did not
  choose an alpha interpretation. Reach: future consumers need an explicit
  background policy before evaluating partial alpha. Verdict: sound; it avoids
  inventing color meaning. Confidence: medium.
- **Core consumes the protocol's pure picture schema.** A public request and a
  retained receipt now share thresholds and defaults. A second Core schema
  could slowly acquire different defaults. Gap: the original dependency graph
  did not place shared picture data. Reach: Core adds an acyclic workspace
  dependency on protocol, whose schema depends only on composition and Zod.
  Verdict: sound; parent approved this one-owner boundary. Confidence: medium.

### Sound — high confidence

- **Normalize request defaults at the public boundary.** When the caller omits
  measurement thresholds, protocol fills them once; native requires those
  normalized values instead of supplying its own defaults. Gap: the plan left
  native/public defaults unspecified. Reach: native requests and retained
  recipes cannot interpret the same request differently. Verdict: sound; each
  wire still validates its untrusted input. Confidence: high.
- **Keep requested masks separate from measured observations internally.**
  A request asks for a face-area rectangle; returned observations contain its
  measured values. Stored `observationRequest` holds the request so merging
  cache options cannot overwrite calculated evidence. Gap: public naming did
  not settle internal recipe naming. Reach: frame and index caches retain
  both request identity and output. Verdict: sound; no second store.
  Confidence: high.
- **Preserve actual profile absence.** A native DeviceRGB image without
  exportable ICC bytes records the profile name and absent hash. The delivered
  PNG's sRGB profile remains a separately observed fact. Assigning an invented
  ICC hash would claim identity the producer never supplied. Gap: the slice
  did not settle this platform representation. Reach: comparisons distinguish
  rendering-space evidence from encoded profile evidence. Verdict: sound;
  parent explicitly required the distinction. Confidence: high.
- **Caller rectangles remain rectangular observations.** A region named
  face-area measures the selected delivered-pixel rectangle, clipped to actual
  bounds; it does not become segmentation. Missing or nonopaque support stays
  unavailable. Gap: semantic labels did not define missing-support behavior.
  Reach: no observation silently substitutes other pixels or authorizes a crop.
  Verdict: sound; intent stays explicit. Confidence: high.
- **Dark edges are evidence rather than crop instructions.** A dark frame can
  have dark edges without black bands. Receipts retain row/column luma
  histograms, opacity and adjacent samples so consumers can inspect that
  distinction. Gap: the slice did not prescribe edge evidence admission.
  Reach: measured darkness cannot silently become letterboxing permission.
  Verdict: sound; admission recomputes reported fractions from operands.
  Confidence: high.
- **Measured requests use existing derivative identity.** A plain cached frame
  cannot answer a request for statistics, nor can an earlier mask answer a new
  mask. Observation options participate in the existing frame/index key. Gap:
  the spec did not prescribe cache identity. Reach: images and complete
  metadata use existing copy, job and lifetime owners. Verdict: sound; no new
  decoder, store or migration. Confidence: high.
- **Extreme exposure controls are test fixtures.** Explicit −4/+4 EV project
  variants demonstrate that measurements follow actual output. They do not
  grade or alter an original recording. Gap: the acceptance needed an output
  perturbation but no magnitude was fixed. Reach: fixture masks remain
  verification rectangles, not product subject detection. Verdict: sound;
  controls test a primitive without making editorial choices. Confidence: high.

Region packaging and bounded thresholds were explicitly delegated to14; their
implementation is frozen in the owning schema and evidence. No unsound or
needs-user integration decision was found.31's provider/threshold hypotheses are
explicitly delegated research and remain rejected for promotion at this point.

## Slice19 — explicit matching proposals

### Sound — high confidence

- **Keep the helper on the delivered processed-clip measurement boundary.**
  When a quiet host is already compressed, the helper predicts a static gain
  after that measured clip stack and preserves its exact revision and range.
  A source-only or dry receipt could instead predict a level before compression
  while the caller applies gain after it. Gap: the plan delegated helper shape
  without choosing a receipt boundary. Reach: the helper requires one selected
  processed receipt per occurrence; repeats and retiming retain separate pins.
  Predictions remain scoped to the measured selection and explicit edits must
  be remeasured. Verdict: sound; the existing public measurement and edit owners
  supply all state, without another product store. Confidence: high.
- **Refuse gain bounds and distinguish explicit peak capping.** If matching
  needs+5dB but the caller permits only+3dB, no treatment draft is supplied.
  If the caller explicitly chooses peak capping, the helper may instead propose
  the peak-safe gain while stating the loudness target is unmet. The alternative
  silently clamping both policies would imply success at a target never reached.
  Gap: explicit bounds and peak policy were required, but their interaction was
  not specified. Reach: consumer callers can inspect constrained evidence and
  choose another treatment; the helper never adds compression or a limiter.
  Verdict: sound; authorization and postconditions stay distinct. Confidence: high.

Parameter/helper packaging and grouping were explicitly delegated to19. Makeup
unity on omission preserves the existing processor meaning; it is not a reader
shim, migration or automatic matching policy. No unsound or needs-user choice
remains in this pass.

## Integrated10B1 — retained source alignment

All entries are sound; none require a user decision. Ranked least-confident first.

## Completion means retained observation, including a refused conditional path

- **When:** slice10, source/public lifecycle.
- **The choice:** A caller can supply more words than the native cells can align.
  When the provider still returns a complete matrix, greedy observations and
  acoustic measurements, publication keeps that evidence ready with
  `conditionalStatus: refused`. Supplied timing is absent. Failing the entire job
  would hide the independent observations; calling the words timed would invent
  an estimate the provider did not return. Operational or malformed-output failures
  remain captured and unpublished.
- **The gap:** The plan required honest refusal evidence but did not define whether
  a conditional-path refusal invalidates other complete observations.
- **The reach:** Readiness certifies admitted retained evidence, never successful
  alignment of every supplied word or lexical truth.
- **Verdict:** sound. Conditional and observed timing remain separate, with complete
  original operands available for inspection.
- **Confidence:** high.

## Read a retained generation explicitly

- **When:** slice10, source/public lifecycle.
- **The choice:** After preparation returns a generation identifier, the caller
  reads that identifier beside its source asset. Removing the optional runtime or
  replacing the current native decoder cannot redirect the read to a newer result.
  An implicit latest-result lookup could instead change which literal question or
  answer was observed between pages.
- **The gap:** The plan pinned source/text/provider identity but did not choose the
  public source-read selector. Root accepted the explicit-generation contract.
- **The reach:** Public continuations keep their generation, display range, view,
  operand and threshold; read-only classification never invokes a provider.
- **Verdict:** sound. It preserves immutable selection and removes execution
  availability from retained reads.
- **Confidence:** high.

## Expose captured refusals separately from published rows

- **When:** slice10, source/public lifecycle.
- **The choice:** If a worker fails after producing a native receipt, a caller can
  inspect that exact generation's raw bytes. The response says captured and
  unverified. Asking for word or score rows still refuses until publication. Hiding
  those bytes would make the failed observation impossible to inspect; labeling
  them ready would imply admission the queue never granted.
- **The gap:** The plan retained raw refusals without choosing how callers inspect
  them through the public surface.
- **The reach:** Raw inspection shares the evidence owner and bounded chunks; it
  does not add a second publication state machine or infer a retry.
- **Verdict:** sound. Inspection and readiness remain distinct contracts.
- **Confidence:** high.

## Integrated31 native-cache research

The provider hypotheses and frozen configuration/interpretation choices were
explicitly delegated to31. Async execution preserves complete native Float32 and
turn operands exactly; the documented context profile fails short confirmation.
Neither result changes the public provider, limits, clocks or quality gates. The
shared replay/invocation owner retains required failures, byte identities and
termination/resource receipts. No unlisted production or user-only decision was
introduced in this research checkpoint.

## Slice20 waveform research checkpoint

Anchor selection, score interpretation, competing-peak bounds and work budgets
were explicitly delegated to20 and remain frozen with its protocol. Lossless WAV
wrapping reuses the existing fixture/LFS owner and actual native re-decode proves
all captured PCM bytes unchanged. No new production owner, clock policy, dependency
or inferred edit was introduced. The failed waveform hypothesis cannot authorize
relationship declaration; lexical research remains independently open. No
unlisted architecture or user-only choice was found in this research pass.

## Native vertical caption alignment — slice22A

- **When:** slice22A, native text layout checkpoint.
- **The choice:** A caption's top/center/bottom setting moves the CoreText frame by
  the measured union of its glyph paths. The receipt records the raw ink rectangle,
  the clipped visible rectangle, and the applied offset. It does not use the text box
  height or typographic leading as a substitute for visible letters. A two-line
  caption is centered by the pixels a viewer can see; clipping says which part remains.
- **The gap:** The slice required truthful glyph bounds but did not choose whether
  alignment follows the nominal text box or rendered ink.
- **The reach:** Native receipts, later decoration masks and visual checks share one
  geometry authority; omitted alignment keeps the existing top behavior.
- **Verdict:** sound. CoreText glyph-path bounds are the observable placement contract.
- **Confidence:** high.

## Empty caption bounds — slice22A corrective review

- **When:** slice22A corrective review.
- **The choice:** Empty text remains a valid transparent raster with zero ink bounds,
  an empty visible rectangle and zero vertical offset. A nonempty source whose font
  cannot provide glyph paths still refuses.
- **The gap:** The original receipt did not state whether no-glyph text was invalid or
  simply invisible.
- **The reach:** Caption validation and decoration handle empty layers without
  inventing bounds or substituting a glyph.
- **Verdict:** sound. The composition schema permits empty text and the native test proves it.
- **Confidence:** high.

## Native caption decorations — slice22B

- **When:** slice22B, native text decoration checkpoint.
- **The choice:** Stroke, shadow and caption background are explicit bounded fields on the
  text source. Native TextRaster draws them from the same glyph geometry as the caption and
  reports the requested decoration fields plus a decoration bounds receipt. A background
  receives padding and corner radius; a shadow uses explicit offsets and blur; no preset is
  imposed on callers.
- **The gap:** The styling contract named useful decorations but had no public fields,
  bounds or native pixel checkpoint.
- **The reach:** Composition validation, compiled layers, native rendering and receipt
  validation share the same schema and reject out-of-range values or mismatched receipts.
- **Verdict:** focused decoration authoring and native actual-pixel checks pass. Public
  static-sheet evidence and visual comparison remain open for the full slice.
- **Confidence:** medium-high.

## Native layer blend modes — slice24

- **When:** slice24, explicit layer-combination checkpoint.
- **The choice:** Blend mode belongs to the surface that is joining its parent, so the
  current compositor remains the sole owner of layer arithmetic. The initial bounded set is
  `normal`, `multiply`, `screen` and `soft-light`; omitted means normal alpha-over. The mode
  is carried through the public processor/compiled operation and the native media receipt.
- **The gap:** The composition graph previously hard-coded alpha-over for every input and
  had no way to request or verify a different combination.
- **The reach:** The same operation order and working color space serve still and movie paths;
  native Core Image kernels are selected only after the compiled mode is validated.
- **Verdict:** focused composition and native red/blue swatch checks pass. Independent
  reference-sheet/vignette comparison remains open before calling the slice complete.
- **Confidence:** medium-high.

## Project-tap alignment ownership — slice10B2

- **When:** slice10B2, prepared project-tap alignment pass.
- **The choice:** A caller first prepares a project tap, then submits alignment against
  that pinned rendered signal. The queue job belongs to the project revision so a
  changed edit cannot silently answer the old request. The generated PCM asset still
  owns the retained alignment rows because the existing alignment evidence/package
  store already authenticates source media assets. On read, rows from that tap use
  their rendered project-clock ranges and keep `occurrence: null`; source-media rows
  continue through exact clip occurrence projection. This avoids pretending a rendered
  mix came from one source clip or creating a second evidence owner.
- **The gap:** The plan required actual inference on selected project audio and one
  retained evidence owner, but did not specify whether the job or evidence owner should
  be the project or generated tap asset.
- **The reach:** Project deletion and revision changes drain or invalidate the project
  job, while package portability can continue to use the existing generated-asset
  evidence path. A future portable project package must preserve the tap asset and its
  publication if it wants to carry these rows without re-inference.
- **Verdict:** sound, medium confidence. It gives the project lifecycle authority to
  the job while preserving the already-tested evidence owner and an honest null clip
  identity for rendered audio. Revisit only if package requirements demand project-owned
  evidence bytes rather than the retained generated asset closure.
- **Confidence:** medium.

## Project-tap evidence reclamation — slice10B2 corrective review

- **When:** slice10B2 review, after tracing project deletion and retry lifetimes.
- **The choice:** Reclaim old alignment rows from the generated tap before a new
  observation, but keep any generation retained by either the ordinary asset-owned
  alignment job or the project-owned tap job. The evidence table is keyed by the tap
  asset, while the queue publication that protects a tap generation can be keyed by
  the project revision, so cleanup checks both ownership paths. Without the second
  check, a later request could delete a still-published project generation; without
  cleanup, stale generations would survive after a new tap observation.
- **The gap:** The existing source cleanup helper only knew about asset-targeted jobs;
  the project-tap pass reused that evidence table but deliberately changed the queue
  target to the project.
- **The reach:** Retry, revision deletion and package reads keep their retained bytes
  until the owning publication/reference is gone. Any future evidence owner must add
  its queue publication to this keep rule or move the rows to a genuinely project-owned
  store.
- **Verdict:** sound, high confidence. The rule follows the actual resource owner and
  prevents both premature deletion and unbounded stale evidence.
- **Confidence:** high.

## Subject framing geometry owner — slice16

- **When:** slice16 bounded authoring checkpoint.
- **The choice:** The caller names the face to frame and supplies the target point,
  margins, zoom limits and crop/contain policy. `planSubjectFraming` turns that one
  pinned observation into geometry and explicit violations; it never chooses among
  faces or silently crops to make an impossible request look successful. A missing or
  duplicate subject refuses, and source-edge or zoom-limit conflicts stay in the plan.
- **The gap:** The slice required constrained framing but left the boundary between
  detection and the edit geometry open.
- **The reach:** Later visual rendering can consume one deterministic plan and compare
  delivered edges. No detector, named-person inference or automatic editorial crop is
  introduced; host-view rendering and mask evidence remain the next gate.
- **Verdict:** sound, high confidence. It preserves the product boundary that
  observations inform explicit caller edits.
- **Confidence:** high.

## Active-word caption timing — slice23

- **When:** slice23 active-word timing checkpoint.
- **The choice:** A caption stores UTF-16 character ranges and exact source-clock word
  windows. The compiler maps each pinned occurrence into project time, and the native
  rasterizer colors all active ranges at the same absolute phase; overlapping speech
  stays overlapping. It does not invent exclusive durations or widen an instant into
  speech support. Entrance/pop motion is a separate later variable.
- **The gap:** The slice named timed highlighting and entrance motion together but did
  not choose the text-index unit or whether overlapping estimates should be sequenced.
- **The reach:** Corrected words need explicit ranges, and all preview/export paths can
  share one clock. Visual static-sheet and entrance-motion evidence remain open.
- **Verdict:** sound, high confidence. It keeps timing evidence exact and refuses to
  turn uncertain overlap into an editorial decision.
- **Confidence:** high.

## Independent blend reference envelope — slice24 sheet

- **When:** slice24 independent sheet/vignette checkpoint.
- **The choice:** Compare every delivered PNG pixel against scalar linear-light equations,
  while comparing encoded patch interiors separately from their edges. When a blue patch
  touches an orange patch, the movie codec shares color samples across the boundary; that
  is visible in the retained images even though the compositor drew the correct pixels.
  The movie arithmetic claim therefore excludes a two-pixel fringe around hard patches.
  A separate smooth vignette checks every movie pixel, including the complete outer falloff.
- **The gap:** The spec required independent arithmetic and movie parity but did not name
  the fixtures or distinguish compositor error from codec boundary mixing.
- **The reach:** This reference can detect missing modes, incorrect alpha and wrong order
  without adding a production renderer. It cannot certify movie patch boundaries or public
  CLI admission; those remain explicit limits rather than silently broadening the claim.
- **Verdict:** sound. PNG proof remains unmasked and the separate smooth movie control keeps
  the codec mask from hiding an actual blend/falloff defect. Thresholds were set before results.
- **Confidence:** medium-high.


## Public blend evidence and visual disagreement — slice24

- **When:** public CLI/MCP closeout and independent review hardening.
- **The choice:** Reuse the frozen native/reference operands and existing service,
  acquisition, PNG/movie and rational-clock observers. Verify export against the
  actual pinned preview and requested canonical destination. Replay retained movie
  clocks without rerendering media unchanged by the new verification code.
- **The gap:** Earlier proof omitted output extent and destination identity, and
  the native preservation check started after still rendering. Five scoped review
  findings prompted direct assertions rather than another product owner.
- **The reach:** Public admission is now evidenced for all seven cases; hardened
  assertions ran on public multiply and all seven native cases. Older public
  receipts remain identified as pre-hardening. Two fresh visual reviews conflict
  on movie seams, so full-raster movie fidelity stays open despite a clean review.
- **Verdict:** sound evidence ownership and honest scope; no threshold, mask or
  release criterion changed to conceal a reported defect.
- **Confidence:** high for arithmetic/admission and exact support; unresolved for
  the disputed movie hard-edge appearance.

## Explicit angle-session ownership — slice21

- **When:** slice21 composition relationship checkpoint.
- **The choice:** Add an `angleGroups` owner separate from linked-edit `syncGroups`. Each group stores a session identity, caller-selected origin clip, evidence id/generation, source asset/stream identities, project validity range and exact signed offset for every member. Public `angle.declare` and `angle.remove` manage the relationship; no speaker name or automatic camera edit is inferred.
- **The gap:** Existing synchronization entries only linked clips for structural editing and could not carry accepted evidence or a source clock relationship.
- **The reach:** Validation rejects foreign/unknown/repeated members, non-media clips, origins outside the group and ranges outside the resolved clip interval. The relationship can survive ordinary placements without adding a second timeline. A retained public/native replay now imports three caller-authored controls, declares their accepted source-bound receipt, and checks frame and preview delivery across the explicit switch; slice20's failed waveform hypothesis still blocks promotion.
- **Verdict:** sound, medium-high confidence for caller-authored delivery. The data owner is explicit and hard-cutover friendly; global synchronization evidence and automatic selection remain deliberately unfinished.
- **Confidence:** medium.

## Transition recipe lowering — slice27

- **When:** slice27 public composition checkpoint.
- **The choice:** Keep transitions as caller-authored convenience operations that lower to the existing gain and opacity processors. Crossfade names two distinct targets and emits opposing ramps; dip and flash name one target and emit a three-point pulse. A project/source pulse must have an even whole-microsecond midpoint, while clip anchors retain exact fractions. The recipe does not add assets, retime media or synthesize an SFX/color layer.
- **The gap:** The transition request needed a reusable public seam but the native graph already owned all required scalar execution. Adding a second transition renderer would create a second clock and duplicate alpha/audio behavior.
- **The reach:** Public composition tests prove the authored curves and explicit midpoint refusal. The canvas/background or caller-selected overlay controls the visible dip/flash color; delivered native audio evidence and motion critique remain open.
- **Verdict:** sound, medium-high confidence. The lowering is small and shares the existing processor/executor contracts, but visual/audio delivery still needs its own evidence gate.
- **Confidence:** medium-high.

## Bounded tonal recovery owner — slice25

- **When:** slice25 composition/native parameter checkpoint.
- **The choice:** Extend the existing ordered source-neutral SDR correction with bounded `shadows` and `highlights` fields and lower them through the same native Core Image executor after temperature, exposure and color controls. Keep identity at zero and preserve the existing extended-linear-sRGB/alpha behavior.
- **The gap:** The feedback asked for tonal controls, but adding a separate grade processor would duplicate working-space, ordering and native readiness ownership.
- **The reach:** Callers can make explicit wall/face corrections without an automatic face grade. Curve, split-tone, reference-conditioned picture evidence and native visual acceptance remain open.
- **Verdict:** sound, medium confidence. The shared owner is clear and focused checks are green, but the native grade still needs frozen reference receipts.
- **Confidence:** medium.

## Retained face association — slice15

- **When:** slice15 temporal association checkpoint.
- **The choice:** Add one pure Core owner that associates adjacent retained Vision face rows by a bounded box-overlap score. Preserve no-face rows as gaps, mark close competing matches ambiguous, and reset on detector errors; never infer a name or silently bridge an error.
- **The gap:** Single-frame Vision receipts already existed, but reframe planning needed a stable observation track without rerunning Vision during replay.
- **The reach:** Movement/gap/ambiguity behavior is deterministic and testable from retained receipts. Native multi-frame acquisition and visual overlay coverage remain open.
- **Verdict:** sound, medium confidence. It preserves uncertainty and keeps replay independent of detector reruns.
- **Confidence:** medium.

## Rounded caption outlines — slice22 public closeout

- **When:** slice22 static public/Unicode acceptance and stroke-bounds correction.
- **The choice:** Round the joins where a caption glyph has a sharp corner. For example,
  a wide outline around `A` previously produced long pointed spikes beyond the
  reported outline rectangle. Rounded joins keep the requested stroke within its
  half-width expansion. The frame/movie rendering recipe identity also changes,
  so an old cached image cannot replace the corrected render.
- **The gap:** The plan requested useful outlines and truthful bounds without
  selecting a corner shape. Keeping sharp joins and expanding the receipt would
  preserve visually distracting spikes; reporting smaller bounds would be false.
- **The reach:** Native stills and movies share this stroke shape. Font identity,
  literal text and glyph placement stay intact; this adds no editor preset or
  separate decoration engine. Clients needing another aesthetic can import an
  explicit graphic rather than inheriting an automatic treatment.
- **Verdict:** sound. One native drawing rule makes the visible outline agree with
  its measured extent, without hiding spill or relaxing the bounds contract.
- **Confidence:** medium-high.

The reversible static fixture uses a compact blue shadow and a distinct rounded
panel. These are example requests, not product defaults. No additional policy
choice is embedded in the imported-font coverage.

## Declared-codec movie target — slice24 full-raster closeout

- **When:** objective resolution of the disputed movie edge critique.
- **The choice:** Judge explicit blend arithmetic through the output format the
  caller actually requested. For example, a sharp green/magenta boundary becomes
  a narrow mixed-color strip when H.264 reconstructs shared color samples, even
  for ordinary alpha-over. Encode the frozen independently calculated picture as
  a single image with no blend treatment, using the same frozen output settings.
  Compare the actual blend movie against that movie over every pixel. First prove
  that the reference's pre-encode still matches the independent arithmetic.
- **The gap:** The earlier full-RGB target conflated a lossy codec's normal edge
  response with a blend arithmetic error; it could not pass even the normal
  control. Masked arithmetic alone could not resolve the reported visual defect.
- **The reach:** Future graders and export checks must preserve raw/pre-encode
  proof and distinguish it from reproducibility through the declared output
  format. A shared codec path is intentional for this isolation, not an independent
  codec certification. Full raw edge loss stays recorded as a limit; no codec
  policy, backend, tolerance or source bytes changed.
- **Verdict:** sound. All hard-patch raw comparisons reach 109 levels, while the
  matched encoded full-raster comparisons pass both samples at two to six under
  the unchanged eight-level bound. Normal substitution fails multiply at 253.
  Fresh image-only review observes shared raw-to-codec changes and no additional
  candidate defect. The parent explicitly approved the corrected target with proof.
- **Confidence:** high for the measured static SDR cases; no general motion/HDR or
  lossless-output claim.

## Banked oracle and default coverage authority — slice24 rereview

- **When:** independent rereview identified remaining fixture-admission gaps.
- **The choice:** A new native run must reproduce the banked independent reference
  digest before using it as the expected picture. A default verification run must
  include each required case exactly once; selecting one case remains explicit.
  If someone accidentally changes the arithmetic helper or drops vignette from
  the report, the checkpoint fails instead of announcing a smaller pass.
- **The gap:** Recording a freshly generated reference digest did not compare it
  with an independent retained identity, and filtering default cases silently
  trusted an incomplete report.
- **The reach:** Native, public and encoded-reference checkpoints share these
  admission checks and one case-name owner. The frozen report remains evidence
  authority; it is not regenerated by the checkpoint under test.
- **Verdict:** sound. Regression tests reject changed identities, omitted cases
  and duplicates; disabling the guards fails those tests. Native all-case and
  public multiply consumers pass without editing banked originals.
- **Confidence:** high.

## Independent RMS arithmetic — slice10 acoustic checkpoint

- **When:** public acoustic boundary verification.
- **The choice:** Compare rounding error separately from classification. When two
  programs measure the same short audio cell, one adds squared samples serially
  and the other compensates for lost low bits. Their RMS values (the square root
  of average sample energy) can differ in the last few digits. Require the same
  exact samples, peak and clock bounds, then bound RMS error from the number of
  additions and double-precision rounding. Classify activity against the retained
  value and the caller's literal threshold, including equality.
- **The gap:** The spec required independent acoustic verification without
  specifying cross-language floating-point comparison. Bit equality would reject
  correctly rounded measurements; a measured arbitrary tolerance would hide bugs.
- **The reach:** This is a verification rule, with no product threshold change,
  lexical label or editing policy. Known zero-energy support still tests exact
  threshold equality. Matching content-addressed source generations are reused;
  a new managed home may require one explicit initial preparation.
- **Verdict:** sound. The bound follows nonnegative summation arithmetic and is
  independent of observed discrepancies; exact claims remain exact.
- **Confidence:** high.

## Fresh rendered-speech evidence — slice11

- **The choice:** A project attempt performs fresh recognition through the existing
  transcript owner; byte-identical PCM never joins an ordinary asset transcript job.
  Durable references retain the generated PCM and transcript generation. The plan
  required fresh evidence but did not prescribe its publication ownership.
- **The reach:** A failed original transcript cannot block this observation. Source
  projection and newly measured words remain separate contracts. Engine metadata
  travels with retained reads so model removal cannot erase observation provenance.
- **Support policy:** Refuse missing selected source support before ASR, preserving
  PCM identity and unavailable intervals in the failure. Zero-filled output cannot
  impersonate observed silence. The caller can explicitly select other support.
- **Cancellation/retry:** Cancel only the parent; independently shared extraction
  remains reusable. Explicit rendered retry recovers a failed/canceled extraction
  prerequisite and creates a new parent attempt. No silent prerequisite retries.
- **Proof boundary:** Consumed PCM identity and independent sample landmarks prove
  a new mapped measurement. Lexical difference is not a gate: real Parakeet completed
  a word whose retained source estimate was cut. Slice12 must inspect contextual evidence rather than
  equating recognized text with a clean join.
- **Verdict:** sound, high confidence for identity/lifetime/mapping; no general
  lexical cut-quality claim or portable package publication claim.

## Extended colors keep the existing clipping owner — slice26

- **When:** slice26 native LUT recipe pass.
- **The choice:** Use the last two samples on a grid edge to continue its color
  response for values below zero or above one. For example, an earlier exposure
  step can make a bright wall brighter than the nominal white value. The LUT
  still transforms that value; the final PNG/movie conversion clips only when
  producing the display format. Clamping before the LUT would silently erase
  the highlight information and change the meaning of ordered corrections.
- **The gap:** The delegated grid/color recipe did not spell out what to do with
  extended working values outside its unit sample domain.
- **The reach:** Future LUT implementations must preserve this interpretation
  and recipe identity rather than inserting a new clipping stage.
- **Verdict:** sound. Independent extended-value and exposure-order controls pass;
  it preserves the established working-space/output-conversion boundary.
- **Confidence:** medium-high.

## An exact identity request keeps the same pixels — slice26

- **When:** slice26 real-shot identity red/green.
- **The choice:** Return the existing image unchanged when every admitted 32-bit floating-point
  grid sample is exactly its identity value. Passing an identity through another
  image kernel changed a few delivered code values because the image engine
  regrouped filters. Returning the same image means that asking for an exact
  no-op cannot introduce another calculation or rounding step; non-identity
  grids still execute the measured trilinear sampler.
- **The gap:** The plan required exact dry pixels but did not prescribe how the
  native image engine should keep an identity from changing filter fusion.
- **The reach:** Exact identity is a semantic guarantee of this recipe. Decimal
  approximations that change a grid value remain real transforms.
- **Verdict:** sound. Complete delivered RGB matches exactly while nonlinear
  interpolation and partial-alpha controls still exercise the real kernel.
- **Confidence:** high.

## Bound the active table set without another cache owner — slice26

- **When:** slice26 native shared-executor integration.
- **The choice:** Retain only tables required by the current frame and refuse
  a frame whose unique active 32-bit floating-point samples exceed 16 MiB. If a timeline moves
  from one grade to another, the old table is dropped; a later frame can reload
  its immutable bytes. The alternative was a growing timeline-wide table cache
  or another scheduler, although the executor already owns surface budgets.
- **The gap:** The bounded format limited one file but left multiple simultaneous
  imported tables' working memory unspecified.
- **The reach:** Complex requests get a truthful budget refusal through the
  existing native error path; no eviction service or new resource kind exists.
- **Verdict:** sound. It is a finite general working-set policy, with individual
  table size bounded independently; it does not weaken the interpolation gate.
- **Confidence:** medium-high.

The size/domain/Float32 trilinear sampler choices were explicitly delegated
reference-replication discretion. Their frozen recipe and rejected quantized
Apple cube candidate are in the slice26 evidence; no user-only decision remains.

## Preserve file admission in portable checks — slice10 closeout

- **When:** prepared project-tap package proof.
- **The choice:** Resolve scratch paths to their actual filesystem location before
  importing or preparing audio. On this Mac, `/tmp` points to `/private/tmp`.
  Using the alias made the existing retained-file reader correctly refuse the
  symlink even though the final audio file was ordinary. The runner now submits
  the actual location; the product's refusal stays intact.
- **The gap:** The fixture procedure did not specify whether scratch roots could
  be filesystem aliases. Weakening the reader or adding a fallback would change
  product behavior merely to accommodate a test path.
- **The reach:** Only the harness resolves caller-supplied paths. No new storage
  owner, compatibility mechanism or production exception is introduced.
- **Verdict:** sound; it exercises existing admission with truthful file operands.
- **Confidence:** high.

## Reuse ordered placements for candidate points — slice12A

- **When:** exact boundary lookup review.
- **The choice:** Find the neighboring placements in the track's existing sorted
  list. If an agent asks about several nearby candidate cut positions, each lookup
  examines only the neighboring entries after searching by start time, rather
  than scanning every clip again. Exact endpoint tests distinguish the clip that
  ends at a point from the clip that starts there.
- **The gap:** The plan prescribed exact mappings, but left lookup structure open.
  The validated composition already guarantees sorted, nonoverlapping placements;
  another interval tree or cache would duplicate that ownership.
- **The reach:** Repeated point reads have logarithmic lookup work with unchanged
  results and no additional index state, lifetime or persisted format.
- **Verdict:** sound; the existing ordering supplies all necessary information.
- **Confidence:** high.

## Declared caption observations — slice23 completion

- **When:** public/native timed-caption and entrance closeout.
- **The choice:** Use declared word observations over generated silent audio to
  isolate mapping and motion from speech recognition. For example, the fixture
  explicitly maps the corrected displayed `Trend!` to the retained row whose
  original text was `wrong`; the product renders the supplied relation, while
  the fixture report says these observations are synthetic. A real recognition
  run would answer a different question: what the model hears in recorded audio.
- **The gap:** The slice required exact repeated/overlapping/corrected timing
  gates but did not select an observation source for this deterministic proof.
- **The reach:** This fixture may certify that requested word windows and
  animation phase survive delivery. It must never certify lexical or phonetic
  truth, which remain with the speech/alignment and contextual-cut gates.
- **Verdict:** sound. The real CLI/native boundary remains exercised, all source
  pins and supplied windows are retained, and the report explicitly excludes ASR.
- **Confidence:** high.

## One mapping owner in caption drafts — slice23 completion

- **When:** corrected/wrapped draft highlight mapping.
- **The choice:** When the caller selects highlight colors, use the helper that
  already wraps the caption to emit its exact display ranges. For example, a
  correction containing an astral glyph occupies two UTF-16 units; the following
  word starts after those units and the actual retained separator or line break.
  An empty correction has no glyph range, and one fragmented row maps to its
  retained fragments without lighting an absent source interval. Without this
  owner, every caller would guess the offsets again after wrapping.
- **The gap:** The product already accepted explicit timed runs; the plan did not
  choose which workflow component should produce corrected display offsets.
- **The reach:** Caption callers inherit literal source/display separation and
  one wrapping calculation. They still select corrections, colors and motion;
  this adds no style preset, fuzzy word matching or automatic treatment.
- **Verdict:** sound. Regression falsification detects the omitted mapping, and
  actual public still/movie output agrees with independently supplied windows.
- **Confidence:** high.

## Mixed-reference local support — slice20

- **When:** bounded synchronization research after unlike-microphone waveform and
  independent lexical refusals.
- **The choice:** Use an edited mixed reference as a bridge into each original
  microphone. Freeze source-rate conversion and full-domain selection first;
  preserve the strict surrounding-window refusals. Freeze a separate local
  hypothesis before measuring exact middle operands, requiring disjoint acoustic
  subanchors and independent Parakeet phrases. A sampled local bridge supplies
  evidence only, with no source relationship or edit declaration.
- **The gap:** Isolated microphones had no shared phrase in the retained windows,
  while master edits made one surrounding-window offset unsuitable. Conditional
  supplied-text alignment would not independently establish shared speech.
- **The reach:** Retained local observations can inform a future synchronization
  hypothesis, but global/raw-to-raw clocks remain refused. Cropped fixtures replay
  strict/local operands and captured recognition, not external full-domain search.
  All failed cases remain retained; thresholds and original precision controls
  stay unchanged. The existing native source-audio owner and WAV/LFS fixture owner
  avoid another product decoder or storage mechanism.
- **Verdict:** sound bounded research; no production estimator promoted.
- **Confidence:** high for retained operand preservation and literal local provider
  observations; global clock and unsampled continuity are not established.

## Keep join repair caller-owned — slice12C/12D

- **When:** bounded contextual repair helper.
- **The choice:** Put the repair loop in the consumer skill helper. It accepts
  one explicit `edit.apply` request pinned to the inspected revision, optionally
  prepares the changed output tap with a finite poll budget, and then calls the
  existing read-only `join.verify` report against the advanced revision.
- **The gap:** The product report must remain read-only, while the workflow needs
  a concrete way to recheck an authorized repair. A product-side automatic cut
  or candidate chooser would turn observations into editorial policy.
- **The reach:** The helper refuses a non-advancing revision, performs no blind
  retry or wording inference, and leaves cut selection, repair scope and no-
  progress decisions with the caller. Real clipped/intact media fixture replay
  remains a separate acceptance gate.
- **Verdict:** sound; one owner per concept and no new public edit operation.
- **Confidence:** high for sequencing and authority boundaries; medium for the
  still-open real-media fixture exercise.
## Source-bound synchronization receipts — slices20–21

- **When:** angle-evidence admission pass.
- **The choice:** Make synchronization evidence a caller-supplied receipt that
  names its evidence id and generation, records an accepted or refused verdict,
  identifies the measurement family (waveform, lexical anchor or mixed
  reference), carries a nonempty fingerprint, and enumerates the asset/stream
  sources. For example, a refused waveform experiment can remain in the saved
  evidence record, but `angle.declare` rejects it; a future accepted estimator
  must provide a receipt whose source list names the same camera streams. The
  composition layer checks and preserves this receipt; it never runs the
  estimator or turns a refusal into an accepted clock.
- **The gap:** Slice20 required a frozen accepted recipe/reference before
  promotion and slice21 required accepted evidence, but neither prescribed the
  durable receipt fields or how a refused experiment should travel through the
  composition boundary.
- **The reach:** Future estimator work owns producing accepted receipts and
  their fingerprints. Angle declarations cannot consume foreign, duplicated or
  refused evidence, while the original failed research remains replayable.
  Changing the receipt taxonomy would affect the public operation and stored
  angle-group format.
- **Verdict:** sound. It keeps measurement ownership with the estimator and
  makes the composition contract explicit without claiming that global sync is
  solved.
- **Confidence:** medium; the boundary follows the plan, while the exact method
  labels and fingerprint field are implementation choices the plan left open.

## Exact source set and origin clock — slices20–21

- **When:** angle validation pass.
- **The choice:** Require the evidence source set to equal the distinct member
  asset/stream identities, reject duplicate evidence sources, and require the
  declared origin member to have zero offset. For example, evidence for cameras
  A and B cannot be reused to declare A and C, and a relationship whose origin
  starts at +500 microseconds cannot quietly redefine the session clock; the
  caller must express that offset on the other member instead.
- **The gap:** The slice named selected sources, a session origin and rational
  offsets, but did not state whether evidence could cover a superset or whether
  origin offsets were normalized by the validator.
- **The reach:** Every downstream angle consumer can treat the origin as the
  stable zero of the declared relationship and can trust that each evidence
  operand is represented exactly once. Future multi-source or nonzero-origin
  semantics require an explicit contract change rather than silent normalization.
- **Verdict:** sound. The validator refuses ambiguous ownership and preserves
  caller-authored offsets without adding a second clock transform.
- **Confidence:** medium; this is the simplest contract consistent with the
  existing exact-offset and source-preservation rules, but the original slice
  delegated relationship semantics.

## Compiler-level switched-angle replay — slice21

- **When:** ordinary-placement replay checkpoint.
- **The choice:** Prove the first switched-angle behavior at the composition
  compiler boundary with three explicit sequential camera placements. For
  example, the caller places camera A for the first second, camera B for the
  second and camera C for the third on one video track; the compiler must emit
  only A, then only B, then only C at the frame cells. The angle declaration
  supplies accepted source-bound evidence, but it does not select or retime a
  camera. Native rendering is kept as a separate later gate.
- **The gap:** Slice21 named a three-angle switched-view ordinary edit but did
  not specify whether the first runnable proof should exercise a native encoder,
  a delivered file, or the existing exact composition compiler.
- **The reach:** This checkpoint locks the caller-owned switching contract and
  catches source or frame-boundary regressions cheaply. It does not certify
  codec output, visual quality or a global synchronization estimator; those
  remain open and require their own evidence before delivery claims.
- **Verdict:** sound. It tests the existing public composition path without
  inventing an angle-selection operation or hiding an automatic editorial choice.
- **Confidence:** high; the product boundary explicitly assigns selection to the
  caller and keeps native delivery as a separate acceptance surface.

## Keep delivered scene changes as evidence — slice30

- **When:** slice30 portable report pass.
- **The choice:** Inspect the committed export file as an immutable external artifact, import that same path through the public asset lifecycle, and read scene observations from the imported video separately from authored project cuts. For example, a measured scene boundary near a project video join is reported as a match, while an audio cut or an unobserved authored join stays distinct. The report declares no editorial decision.
- **The gap:** The slice required delivered-pixel observations and authored-join association but did not prescribe a new detector or a combined timeline shape. Existing source-scene observations remain the owner; the native export/import checkpoint covers planted flash/hold changes, and the retained physical empty-edit receipt now proves source support, refused direct reads and the corresponding black project/export interval separately.
- **The reach:** Future repair and review work can use one report to compare physical delivered changes with the revision that produced them without relabeling cuts or silently editing a project. A black frame without source-support evidence remains insufficient; declared acquisition holes and authored black cards stay separate.
- **Verdict:** sound. It preserves source bytes, exact clocks, coverage state and the product boundary that detection supplies evidence rather than permission.
- **Confidence:** high.

## Keep motion treatments explicit — slices27–29

- **When:** transition, trajectory and blur composition pass.
- **The choice:** Lower zoom and directional whip requests into the existing
  geometry processor, require caller-supplied overscan for travel, and represent
  motion blur as a bounded processor with samples and shutter. Identity settings
  bypass blur; uncovered travel refuses instead of exposing a synthetic edge.
- **The gap:** The slices asked for reusable motion primitives but left the
  lowering owner and coverage policy open. A second renderer or an automatic
  crop would duplicate picture ownership or hide missing pixels.
- **The reach:** Composition remains exact and non-editorial; native delivery
  consumes ordinary geometry/visual operations. Delivered motion appearance and
  cost evidence remain explicitly open.
- **Verdict:** sound for the structural checkpoint; no delivered-quality claim.
- **Confidence:** high for bounds and ownership, medium for native visual parity.

## Use a fixture-scoped no-gap threshold — slice27

- **When:** moving crossfade delivery receipt.
- **The choice:** Use a `0.98` black-pixel share as a refusal threshold for the
  sparse alpha/mirror control, while keeping the actual frames and a fresh
  visual critique in the receipt. In plain terms, the check rejects an all-black
  or nearly empty delivered frame, but it does not pretend that a sparse source
  should fill the entire canvas.
- **The gap:** The slice required a black-gap check on moving footage but did
  not define a universal scene occupancy target. Applying a full-frame density
  threshold would reject the retained transparent-background fixture for the
  wrong reason; omitting a threshold would miss an empty delivery.
- **The reach:** This bound is intentionally fixture-scoped. Future
  reference-conditioned or dense footage must declare its own coverage mask and
  cannot inherit `0.98` as a picture-quality rule.
- **Verdict:** sound. It tests the failure the moving control can expose without
  turning sparse source composition into an editorial or aesthetic verdict.
- **Confidence:** medium; the need for a no-gap refusal is in the slice, while
  the numeric threshold and fixture scope were implementation choices.

## Preserve a failed moving reference oracle — slices27–29

- **When:** strict moving transition/trajectory parity investigation.
- **The choice:** decode the retained alpha and mirror ProRes sources with the
  pinned FFmpeg, compose the declared opposing-opacity crossfade in a small
  independent linear-light RGBA oracle, and retain three native PNG comparisons
  as a machine-readable failed audit. Keep the standard zero-difference rule;
  do not tune it to the current implementation.
- **The gap:** the existing moving receipt proved only non-black coverage and a
  midpoint change. It had no frozen visual reference and could not distinguish
  a real delivery defect from a missing comparison operand.
- **The reach:** the new audit proves that the native samples follow the
  window-bounded identity behavior and differ only by one-code-value rounding
  (maximum MAE 0.0723, 21.68% differing pixels), while the midpoint is near
  parity. It closes no strict visual gate and makes no claim that this oracle's
  color tolerance is the eventual accepted transition contract.
- **Verdict:** sound failure evidence. It is independent of the production
  compositor, source-hash bound and replayable without rerendering.
- **Confidence:** high for the measured mismatch and fixture identity; low for
  choosing this standard crossfade oracle as the eventual accepted aesthetic.

## Measure blur at public delivery — slice29

- **When:** motion-blur delivery receipt pass.
- **The choice:** Record wall-clock time for the public frame journey in the
  retained receipt, split into readiness polling, final file delivery and total
  elapsed time for both the unblurred control and the blurred candidate. For
  example, the current receipt can say that the candidate took about 64 ms more
  than its same-run control, while still identifying the four requested blur
  samples separately from the one decoded source sample.
- **The gap:** The slice required observed render cost but did not define where
  that measurement should be taken. A native-only counter would miss public
  transport and delivery work; a pixel count alone would not show the caller's
  cost.
- **The reach:** Future blur recipes can compare bounded work at the same public
  seam without treating one machine's wall-clock value as a quality verdict.
  The receipt remains diagnostic and does not close the still-open appearance
  gate.
- **Verdict:** sound. It measures the user-visible journey while preserving the
  distinction between requested sample count, decoded source support and local
  elapsed time.
- **Confidence:** medium; the plan required cost evidence but left the exact
  receipt fields and timing boundary to the implementing agent.

## Bound blur radius to the shutter envelope — slice29 appearance repair

- **When:** motion-blur appearance repair pass.
- **The choice:** Treat the requested sample count as a bounded work budget and
  derive the Core Image radius from the shutter interval, with a small floor.
  Sample count remains a bounded work budget. The public receipt compares the candidate with an
  unblurred copy of the same authored trajectory and accepts at most one pixel of
  visible edge expansion.
- **The gap:** The first native lowering multiplied `shutter * samples`, which
  inflated the moving red/blue control and produced a broad asymmetric smear. The
  slice required bounded appearance but did not define how sample count affected
  the filter radius.
- **The reach:** Four-sample delivery changes the unblurred trajectory control in
  329 pixels and changes that control again in 232 blur-specific pixels, remains
  opaque, and retains the same geometry phase. Strict parity against a separate
  reference recipe and source-edge refusal remain open; the one-pixel envelope is
  a fixture-scoped delivery invariant, not a universal aesthetic score.
- **Verdict:** sound for the repaired bounded recipe. The regression was observed
  red with the old radius, then green after the correction; the unprimed critique
  found no displacement, clipping or transparency defect.
- **Confidence:** high for the footprint regression and public delivery behavior;
  medium for reference-conditioned visual parity.

## Replay bounded blur appearance evidence without rerendering — slice29

- **When:** motion-blur appearance repair closeout.
- **The choice:** add a small immutable checker over the retained public/native
  receipt and its three PNG artifacts. It binds the source and native identities,
  exact four-sample recipe, measured changed pixels, opacity and one-pixel
  trajectory envelope; it does not rerun native rendering or accept a visual
  tolerance.
- **The gap:** the receipt proved the behavior once, but later edits could alter
  its JSON or images while leaving the focused suite green.
- **The reach:** a cheap replay now refuses changed bounds, measurements,
  dimensions, hashes or recipe fields. Strict reference-conditioned appearance
  parity remains open and the checker makes no universal aesthetic claim.
- **Verdict:** sound scoped evidence replay; it has one artifact owner and no
  second blur implementation.
- **Confidence:** high for the retained fixture and envelope; medium for any
  broader footage appearance outside this control.

## Keep intentional-jump recognition refusal explicit — slice12C

- **When:** real-media contextual-join fixture pass.
- **The choice:** Treat a rendered-recognition job that refuses because one word
  estimate falls outside the intentional source jump's delivered interval as an
  observed limitation, then run `join.verify` without a fabricated transcript.
  For example, the jump still reports the exact before/after source positions,
  prepared sample support and acoustic activity, while rendered recognition is
  `missing` and phonetic completeness stays `unknown`.
- **The gap:** The slice required an intentional-jump fixture and honest missing
  coverage but did not say whether a failed fresh recognition attempt should be
  retried, clipped to fit, or retained as a refusal.
- **The reach:** Future repair workflows can distinguish a physical timeline jump
  from missing speech evidence. The product never turns an inference refusal into
  silence or an automatic edit; a caller must author any repair and recheck it.
- **Verdict:** sound. It preserves the zero-editorial-decision boundary and the
  frozen Parakeet word-completion limitation while still proving delivered audio.
- **Confidence:** high.

## Let the consumer discover the clipped Parakeet edge — slice12D

- **When:** fresh-agent contextual repair replay.
- **The choice:** Select the clipped case from public receipt evidence by requiring divergent recognition plus an energetic delivered tail, then use the intact same-asset control to author one full-range replacement. The product remains read-only; the consumer owns the edit and changed-output recheck.
- **The gap:** The slice required an unhinted discovery but did not prescribe how a fresh process should distinguish the clipped edge from an intentional jump or a complete control.
- **The reach:** The helper can be replayed from retained operands without a timecode hint, while the threshold and case selection remain fixture-scoped consumer logic rather than a new product verdict.
- **Verdict:** sound. The real isolated run discovered `clipped`, advanced the revision, rendered Parakeet again and observed `Fortunately,`; phonetic completeness remains unknown.
- **Confidence:** medium; the planner is intentionally narrow to this retained fixture and is not a general editorial detector.

## Route focused use-case references through one case-selected helper — slice33

- **When:** fresh-agent routing checkpoint for launch, podcast and teaser workflows.
- **The choice:** Keep the three story references separate, but give a new
  consumer one public, case-selected helper that verifies the index link,
  records the exact reference hashes and returns the shared capability-first,
  no-default-install and no-human-QA policy. For example, a fresh process can
  pipe `{ "useCase": "teaser" }` to `use-case-routing.mjs` and receive a
  portable receipt before it touches media.
- **The gap:** The focused references existed, but a fresh agent had no small
  runnable checkpoint proving which file owned each story shape or that the
  installed bytes matched the retained evidence.
- **The reach:** Routing is now reproducible and provenance-pinned without
  pretending that documentation has delivered a video. Caption/music
  interchange, native editing and clean-state media replay remain slice34 work.
- **Verdict:** sound for the routing checkpoint; slice33 remains partial until
  its media-aware examples and slice34 delivery gates pass.
- **Confidence:** high for path/link/hash policy, low for the still-open native
  delivery and visual/audio acceptance gates.

## Reuse canonical media for independent corpus controls — slice01

- **When:** physical corpus certification needed small negative controls without
  duplicating source media.
- **The choice:** Bind a feature-owned manifest and verifier to the existing
  canonical synthetic corpus under `specs/done/agent-editing/assets/00-corpus`.
  Hash the canonical manifest, hand-authored oracle, and each decoded operand;
  check rational boundaries, known offset/drift, unrelated audio, asymmetric
  rotation, alpha/flat patches, edge landmarks, wrong supplied text, blank
  input and a transition gap.
- **The gap:** These controls cannot establish real speech, camera quality,
  multicamera continuity or speaker identity, so the real eight-case corpus and
  later speaker/synchronization slices remain open.
- **The reach:** One public verifier supplies deterministic negative controls
  without a second media owner, compatibility path, or human labeling task.
- **Verdict:** sound for the independent-control checkpoint; the scoped
  eight-case behavior ledger now passes, while slice01 remains in progress until
  whole multicamera behavioral certification is measured.
- **Confidence:** high for byte/oracle integrity and declared control scope.

## Keep fresh replay as an identity gate — slice34

- **When:** fresh-agent delivery handoff pass.
- **The choice:** Put clean-state and relocated-state comparison in one consumer
  helper that hashes the brief, source files, selection, recipe and delivered
  artifact. For example, two receipts with the same source and instructions but
  different output bytes are refused, while native readiness, decoded picture and
  audio review remain explicitly unverified until their own checks run.
- **The gap:** The slice required reproducible delivery without human QA but did
  not say whether a portable checker should decode media or merely establish that
  the two agents acted on the same inputs and produced the same bytes.
- **The reach:** Fresh agents get a small, deterministic replay checkpoint and
  cannot accidentally overclaim visual or audio acceptance. A later media-aware
  workflow can consume this identity result and add its own owners without
  duplicating source-integrity logic.
- **Verdict:** sound. Identity parity is useful evidence, but it cannot stand in
  for native, visual or acoustic verification.
- **Confidence:** high; the slice explicitly separates replay identity from the
  stronger media gates.

## Auto-prepare the measured first-party speaker recipe, while keeping quality provisional — slice31

- **When:** speaker provider handoff pass.
- **The choice:** Register the measured Sortformer model/runtime acquisition with
  immutable URLs, hashes, install groups, native relocation policy and owned
  preparation resources. First-party speaker preparation therefore downloads its
  pinned inputs by default, while callers may still supply a verified local source.
  Keep the exact-30-second anonymous observation envelope and the long-form quality
  gate unchanged.
- **The gap:** Acquisition readiness and diarization quality are separate claims.
  The retained provider still fails the ten-minute four-speaker continuity gate and
  does not infer named people, even though its runtime can now be reproduced by the
  model lifecycle.
- **The reach:** The generator owns the acquisition descriptor and checks it against
  the measured runtime inventory/native policy. Future work must pass continuity,
  overlap/unknown and labeling gates before widening the supported envelope.
- **Verdict:** sound; first-party model inputs auto-prepare from the measured pinned
  recipe, while the quality limitations remain explicit.
- **Confidence:** high for acquisition identity and lifecycle behavior; low for any
  claim beyond the retained exact-window evidence.

## Retain native streaming as a bounded research envelope — slice31

- **When:** the pinned NeMo runtime preserved state across internal chunks on a
  retained three-speaker 600-second control, while the required four-speaker
  overlap control remained below the fixed recall gate.
- **The choice:** Add a read-only envelope replay that binds one fresh native
  state to each selected input, requires persistence across internal 27.2-second
  chunks, and requires reset between selections. Keep public preparation at
  independent 80ms-grid windows through 30 seconds and mark promotion false.
- **The gap:** The long receipt showed useful stateful execution evidence, but a
  future edit could mistake that run for general long-form labeling support or
  accidentally reuse state across selections.
- **The reach:** The focused test verifies the state boundary and retains both
  the passing three-speaker control and failed four-speaker overlap control
  without rerunning inference or widening quality claims.
- **Verdict:** sound as a bounded replay contract; long-form continuity, stable
  identity and named-person inference remain open.
- **Confidence:** high for the retained state-scope and gate values; low for any
  envelope beyond the measured controls.

## Join selected speaker generations in project transcript rows — sound, medium confidence

- **When:** slice32 managed project-transcript checkpoint.
- **The choice:** accept an explicit `speakerGenerations` selector per project
  source. The project evidence owner resolves the pinned generation, reads its
  retained turns once, and decorates projected words with the existing attributed,
  overlap or unknown result. The selector and a digest of its caller bindings are
  part of the immutable query identity, so retimed repeats and cursor continuation
  cannot silently switch evidence or labels.
- **The gap:** project speaker interval reads already projected turns, but project
  transcript rows had no way to carry the same evidence; consumers had to join two
  independently paged responses and could misalign repeated occurrences.
- **The reach:** the public protocol and managed core now keep one project-owned
  join. It never infers identity, assigns partial words, or treats a camera owner
  as a speaker. Immutable package transcript joins and selected-range continuity
  remain separate open gates.
- **Verdict:** sound for explicit managed project joins; the long-form quality and
  package replay gates remain unchanged.
- **Confidence:** medium; focused core/protocol checks pass, while the full public
  media workflow is still open.

## Carry landmark coverage into framing without widening detector boxes — slice15/16

- **When:** the frozen full-face localization gate stayed red because Vision's
  rectangle remained high-confidence while Graham's hand and pose hid part of the
  face.
- **The choice:** Run Vision landmarks against the exact published rectangles,
  retain the groups actually returned with `core`, `partial` or `unavailable`
  coverage, and carry that evidence through face tracks. Subject framing keeps its
  caller-authored geometry proposal but adds a quality violation for partial or
  unavailable coverage.
- **The gap:** Detector confidence and continuous association did not tell a caller
  whether the selected rectangle had enough visible landmarks for a quality-aware
  reframe. Expanding the rectangle or lowering the gate would have hidden the
  observed failure and changed the frozen oracle.
- **The reach:** Consumers can distinguish detector presence from landmark quality
  without a second face identity owner or an automatic crop. The full-face gate
  remains red until an independently verified recipe supports it; no named identity
  or complete-head claim is made.
- **Verdict:** sound for bounded quality evidence and refusal reporting; native
  full-face localization and broader visual acceptance remain open.
- **Confidence:** medium; Swift target compilation and focused protocol, composition
  and core tests pass, while the media-aware native worker receipt still needs a
  prepared full runtime.

## Preserve the contracted-box failure as a bounded face-quality audit — slice15

- **When:** a fresh Graham-only replay used the landmark-aware Vision worker against
  the frozen 72-frame corpus.
- **The choice:** retain a machine-readable audit showing the 27 failed ordinals,
  contiguous ranges, IoU/confidence bands, and center containment. Keep the full-face
  gate red even though Vision returns core landmark groups for the contracted boxes.
- **The gap:** the existing receipt showed that the rectangle shrank but did not
  quantify why confidence thresholding, tracking, or landmark presence could not
  repair the mismatch.
- **The reach:** dependent framing work has an explicit refusal boundary and a
  reproducible reason to reject box widening, relaxed overlap, or automatic head
  completion. A future detector change must replay the same frozen oracle and prove
  complete-region recovery before this gate changes.
- **Verdict:** sound scoped evidence; no product correction is justified by the
  current native Vision path.
- **Confidence:** high for the retained arithmetic and replay identity; low for any
  future detector that might recover hidden head area.

## Make the red full-face failure replayable without changing its gate — slice15/16

- **When:** the retained Vision receipt showed 27 Graham box/zone IoU failures, but
  the failure audit was documentation rather than an executable guard.
- **The choice:** add a small inference-free replay that binds the retained native
  evidence, gates, audit and worker identities, recomputes each box's IoU and center
  containment, and requires the exact failed ordinal set. Keep the status open.
- **The gap:** a changed box, source binding or threshold could otherwise make the
  red result appear green by editing report metadata; rerunning Vision would mix a
  new detector result into frozen evidence.
- **The reach:** the acceptance suite now proves the known limitation remains honest
  and gives a future detector recipe a precise oracle to replace. It adds no second
  detector, box widening, crop policy or human QA step.
- **Verdict:** sound bounded failure/replay gate; full-face localization remains
  open until an independently measured recipe recovers the complete requested region.
- **Confidence:** high for receipt identity and arithmetic; low for any future
  detector's ability to recover the occluded head area.


## Use the authored rectangle for whip coverage — slice28

- **When:** directional whip transition lowering with caller-supplied geometry.
- **The choice:** Compute admitted travel from the fixed rectangle dimension on the travel axis when one is supplied; refuse animated or non-positive dimensions.
- **The gap:** Canvas-only bounds could let a smaller authored rectangle expose an uncovered edge.
- **The reach:** The public transition operation now rejects travel beyond the authored coverage budget without adding a second geometry owner or automatic crop. Native delivered trajectory parity remains open.
- **Verdict:** sound for the deterministic composition guard; visual delivery remains a separate gate.

## Keep estimator admission separate from synchronization proof — slice20

- **When:** bounded synchronization follow-up after the real unlike-microphone
  waveform and lexical hypotheses refused.
- **The choice:** Add one small receipt adapter at the estimator boundary. It
  accepts only a `constant-offset` result with three selected anchors inside the
  estimator's spread policy, binds the evidence id/generation and exact source
  identities, and hashes those operands into the receipt fingerprint. Drift,
  ambiguity, duplicate sources and malformed measurements remain refused or
  fail before evidence can be consumed.
- **The gap:** The estimator returned useful numerical controls but had no
  single owner for converting a successful control into the source-bound
  evidence shape required by `angle.declare`. Without that seam, callers could
  copy offsets or fingerprints inconsistently.
- **The reach:** Synthetic known-offset controls can now produce a complete
  accepted evidence receipt, while the nine real unlike-microphone comparisons
  remain refused and no angle declaration or retime is automatic. A future
  accepted real estimator can feed the existing composition contract directly.
- **Verdict:** sound for bounded admission; it does not close global
  synchronization or promote the frozen real corpus.
- **Confidence:** high for receipt identity and refusal semantics; low for
  global/raw-to-raw synchronization, which remains an explicit open gate.

## Admit bounded selected speaker ranges without cross-window identity — sound, medium confidence

- **When:** slice32 selected-range preparation pass.
- **The choice:** Replace the public exact-30-second admission with complete mono16k ranges on the provider's 80ms score grid, from 80ms through at most 30 seconds. Retain dynamic PCM and score extents in each generation. Treat every selected range as an independent invocation; slot numbers and labels never carry identity across windows or sessions.
- **The gap:** The exact-window restriction blocked callers from preparing a selected transcript span, while the measured provider still has no passing long-form four-speaker continuity gate.
- **The reach:** Shorter selected transcript/project reads can be prepared and replayed without padding or silently dropping score cells. Longer ranges and cross-window identity remain explicit unsupported/open behavior; no model or runtime was changed.
- **Verdict:** sound for bounded preparation and honest refusal; slice31's long-form continuity gate remains red.
- **Confidence:** medium; the contract and fixtures pass, but native live-device execution is unavailable in this environment.

## Use the existing production journey as the media-aware fresh-agent checkpoint — slice34

- **When:** the identity-only replay gate could not prove decoded media behavior or the planted speech repair.
- **The choice:** Reuse the production CLI/MCP preview and export journey, run it from clean and relocated scratch roots, normalize only the delivered movie for deterministic byte comparison, and join the already pinned Parakeet repair receipt. The harness records decoded picture/audio invariants and source-preservation hashes without copying source media or models into Git.
- **The gap:** A second renderer or a synthetic receipt would test a different contract. The existing journey already exercises the public transports, native renderer, atomic export and audio/video replacement paths.
- **The reach:** Slice34 now has one reproducible media-aware checkpoint while global synchronization, long-form speaker continuity and strict reference parity remain separate gates.
- **Verdict:** sound for the concrete fixture workflow; not a whole-spec completion claim.
- **Confidence:** high for the retained run; medium for broader editorial workflows outside this fixture.

## Make fresh media acceptance execute focused workflow routing — slice33/34

- **When:** the media-aware replay claimed capability routing but only exercised
  the public editing journey.
- **The choice:** call the consumer skill's existing routing owner before media
  work for `launch`, `podcast` and `teaser`, then retain each selected reference's
  hash and policy in the replay receipt. The acceptance harness records the result;
  it does not copy the route table or invent a second editorial policy.
- **The gap:** the earlier receipt could say routing was verified while proving only
  delivery and speech repair, leaving a fresh agent's first workflow decision
  outside the acceptance boundary.
- **The reach:** a changed or unlinked focused reference now fails the concrete
  replay before media work, and the receipt tells a later agent exactly which skill
  bytes were used. Media quality, synchronization and long-form speaker gates stay
  separate rather than being implied by routing success.
- **Verdict:** sound; the route helper remains the single policy owner and the
  replay adds only provenance at the acceptance boundary.
- **Confidence:** high; the route helper's existing focused tests and the fresh
  media replay both pass.

## Replay native delivered-scene evidence without rerunning detection — slice30

- **When:** the native scene receipt already contained a committed export, planted
  flash/gap/hold observations and source-preservation checks, but no cheap replay
  guard prevented that evidence from drifting.
- **The choice:** validate the retained report's exact scene windows, immutable
  export metadata, bytes and hash from a small evidence checker. Keep detector
  execution in the production scene helper; the checker only verifies the frozen
  receipt and never turns an observation into an edit.
- **The gap:** rerunning native scene detection for every focused test would be
  expensive and would mix a new detector result with the historical acceptance
  claim; a static JSON check alone would miss a changed export file.
- **The reach:** the planted native checkpoint now fails if its physical gap,
  hold/flash times, source-preservation flag or export bytes change. Broader
  transition/audio and visual parity still require their own evidence.
- **Verdict:** sound scoped replay; it adds no second scene detector or editorial
  decision owner.
- **Confidence:** high; the retained native report and export pass exact replay,
  and the mutation control refuses a changed gap.

## Replay moving trajectory delivery evidence without rerendering — slice28

- **When:** the native moved/split zoom receipt already contained public frame, preview and export results, but no cheap guard prevented its structural claims from drifting.
- **The choice:** Add a small immutable receipt checker that asserts the case, native/runner/decoder identities, 39-picture count, accepted membership controls and exact preview/export hashes. A mutation test changes one retained count and must be refused.
- **The gap:** Re-running native rendering for every focused test is expensive and would mix a new worker result into the historical claim; the checker verifies the retained delivery contract without claiming visual parity.
- **The reach:** The trajectory delivery checkpoint is independently replayable in the ordinary test suite. Frozen color/perimeter parity, blur appearance parity and source-edge refusal remain explicit open gates.
- **Verdict:** sound scoped replay; no second renderer or trajectory policy owner.
- **Confidence:** high for receipt identity and structural delivery; low for unresolved reference-conditioned visual parity.

## Bind retained corpus cases to scoped behavior receipts — slice01

- **When:** the eight retained real-media cases had physical hashes and clocks, but the three picture entries still said `unverified` even though the accepted native picture replay already covered them.
- **The choice:** add one aggregate checker that requires every physically certified case to name an existing behavior receipt, hashes that receipt, and accepts only the already-established recognition/timing or sampled-picture states. The checker reports its scope and never treats the receipt as proof of global camera synchronization, speaker continuity, or editorial quality.
- **The gap:** the corpus manifest had separate physical and behavior evidence owners but no executable link proving that every real case was covered by one of them.
- **The reach:** future fixture edits fail the scoped ledger before they can look certified through a stale manifest; the physical, multicamera, sync and speaker owners remain separate and can be strengthened independently.
- **Verdict:** sound; this closes an evidence-link gap without turning a bounded receipt into a whole-spec claim.
- **Confidence:** high for the manifest/evidence relationship; medium for the still-open multicamera behavioral gate.

## Add compact decoded picture samples to the multicam fixture owner — slice01

- **When:** the retained unlike-microphone bank certified physical WAV windows but had no replayable picture behavior for the three camera sources.
- **The choice:** retain one tiny three-frame H.264 derivative per source, bound to the existing 0s, 240s and 1200s source selections. The public verifier decodes all nine RGB samples and checks both derivative bytes and decoded-frame hashes.
- **The gap:** source-video paths remain external and the sample set cannot prove a shared clock, continuous camera quality, speaker identity or camera selection.
- **The reach:** multicam fixture coverage now includes a deterministic picture behavior checkpoint without copying original movies or adding a renderer. The explicit synchronization refusal and broader composition gate remain intact.
- **Verdict:** sound for sampled picture behavior and physical preservation; whole multicamera behavioral certification is still open.
- **Confidence:** high for the retained derivative/decoded identities; medium for broader multicam behavior outside the sampled windows.

## Keep the Ultra-8 long run exploratory — slice31

- **When:** the independently trained eight-slot speaker candidate was available after its short-control stop, and a long-form hypothesis needed a concrete measurement.
- **The choice:** retain the 336.32-second and 600-second native score outputs, request identities and automatic scorer metrics in a compressed replay bundle. Mark the bundle exploratory because the long protocol was not frozen before this inference; it cannot promote the provider or close the required continuity gate.
- **The gap:** the short candidate failure stopped a preregistered long expansion, but discarding the observed long result would lose useful evidence about the model's failure mode.
- **The reach:** the next provider hypothesis now starts with exact evidence: the three-speaker control passes, while the four-speaker control fails DER, overlap recall and identity confusion. The replay refuses changed operands before scoring and leaves public speaker defaults untouched.
- **Verdict:** sound as directional research evidence; insufficient for acceptance by design.
- **Confidence:** high for the retained hashes and scorer reproduction; low for any conclusion beyond these two controls.

## Replay retained multicam selections through native delivery — slice01

- **When:** physical source windows and decoded picture samples were certified, but the nine caller-authored multicam selections had not yet crossed the public CLI/MCP and native renderer boundary.
- **The choice:** when an agent chooses Graham sample 1, for example, the runner imports the retained three-frame Graham derivative, places only its one-second sample-1 range at the requested project position, asks the public CLI/MCP and native renderer for a frame and a preview, and records the bytes and decoded RGB pixels. The direct project frame is compared with a separately captured native read of that same source sample; the MP4 preview is compared with that read using a declared H.264 round-trip tolerance. Replay first calls the existing corpus and caller-recipe verifiers, then opens every retained PNG/MP4 and recomputes its hashes and mean absolute pixel errors. A separate worker-identity file binds the native binary hash to the report.
- **The gap:** fixture hashes alone could not show that native composition preserved every retained source choice. A synthetic angle control could not cover the real retained picture inputs, while a report that only repeated numbers could be edited without touching the delivered files.
- **The reach:** the native receipt and replay test cover all nine retained source/sample selections without adding synchronization, speaker identity or automatic camera choice. The runner refuses a non-empty output directory so a failed rerun cannot leave two process-specific receipt sets mixed together. The source-choice and synchronization owners remain separate.
- **Verdict:** sound scoped native delivery gate; broader synchronized multicamera behavior remains open.
- **Confidence:** high for source identity, selection order and native frame preservation; medium for encoded preview parity because the codec tolerance is explicit rather than byte-exact.

## Bind native multicam replay to worker and complete preview artifacts — slice01

- **When:** the first native multicam receipt compared retained images, but its
  worker sidecar was only indirectly tied to the report and preview replay
  accepted a fixed frame prefix.
- **The choice:** retain an explicit `workerIdentity` path and file hash in the
  report; replay requires a regular sidecar file whose `native-worker` kind and
  binary SHA-256 match the report. Use the caller-authored behavior verifier as
  the sole source/sample schedule owner, and decode one frame beyond the nine
  authored frames so shortened or extended previews are refused.
- **The gap:** a metadata-only worker edit, duplicate schedule copy, or extra
  preview frame could otherwise leave the numeric receipt looking unchanged.
- **The reach:** replay now proves the retained worker/artifacts and complete
  preview extent without claiming synchronization, speaker identity or camera
  choice. Failed runs remove partial output; reruns still refuse a non-empty
  directory before doing work.
- **Verdict:** sound bounded verifier hardening; no production renderer or
  synchronization policy changed.
- **Confidence:** high for retained artifact identity and exact nine-frame
  extent; broader multicamera behavior remains open.



## Replay all retained real synchronization refusals — slice20

- **When:** the unlike-microphone estimator had a frozen original/derivative comparison set, but no cheap executable guard that kept every real result refused after later edits.
- **The choice:** add a case-selected replay that verifies all nine source/window results against the original numerical operands (ignoring elapsed runtime only), checks the physical multicam window bank first, and rejects any admitted real offset or missing anchor coverage.
- **The gap:** a receipt-adapter control pass and a saved research report could drift independently from the actual retained real comparisons; rerunning inference would add cost and a new model/runtime variable.
- **The reach:** the real synchronization refusal is now independently replayable and source-bound without declaring a clock, retiming media or adding a second estimator. The accepted synthetic constant-offset receipt controls remain separate.
- **Verdict:** sound as a bounded refusal/replay gate; global/raw-to-raw synchronization and lexical anchors remain open.
- **Confidence:** high for retained numerical identity and refusal scope; low for any synchronization claim beyond the retained windows.

## Close the declared corpus scope after replaying every owner — slice01

- **When:** the corpus, behavior ledger, independent controls, multicam samples and native delivery receipt all replayed green in one focused run.
- **The choice:** mark slice01 complete only for the declared fixture scope. Physical bytes, clocks, sampled pictures and native source choices are certified; synchronization, speaker identity and automatic camera selection remain separate contracts with their own open gates.
- **The gap:** the plan did not state whether a green set of bounded corpus owners was enough to close the fixture slice while dependent behavioral capabilities were still incomplete.
- **The reach:** later work can rely on the retained media and its independent controls without treating fixture certification as proof of global sync, speaker continuity or editorial quality.
- **Verdict:** sound; the status follows the slice's explicit bounded scope and the focused 41-test replay.
- **Confidence:** high for the declared corpus contract; high that the separate capability gates must remain open.

## Keep the native half-float compositor after the precision probe — slices27–29

- **When:** moving transition frames differed from an independent linear-light oracle by only one code value across a bounded set of pixels, so the compositor's working precision was a plausible cause.
- **The choice:** build a temporary worker with full-float (`RGBAf`) working surfaces, compare the same moving frames, and keep the shipped half-float (`RGBAh`) format because the PNGs and mismatch metrics were identical. The probe is retained as evidence, not as a production toggle.
- **The gap:** the slice assigned the cause of the one-code-value drift to measured investigation but did not prescribe which internal precision to retain when the experiment was inconclusive.
- **The reach:** future parity work must address the actual color/compositing path rather than silently changing precision or widening the tolerance. The strict moving reference gate remains open.
- **Verdict:** sound; the experiment ruled out this specific cause without changing shipped behavior.
- **Confidence:** high for the bounded probe result; low for any broader claim about all compositor formats.

## Close the focused use-case references at their routing boundary — slice33

- **When:** launch, podcast/interview and teaser references each had a case-selected router and immutable reference hashes, while the final media replay still depended on the separate workflow slice.
- **The choice:** close slice33 for the reference/routing contract and leave media-aware examples, rendered acceptance and unresolved capability gates owned by slice34. The teaser's question-end strategy stays in its own reference.
- **The gap:** the plan did not distinguish a complete guidance surface from the downstream media workflow that consumes it.
- **The reach:** future edits to use-case guidance can be checked through the router without implying that the complete native trailer workflow or open speaker/sync/visual gates are solved.
- **Verdict:** sound bounded closure; no editorial engine or media claim is added.
- **Confidence:** high for the declared slice scope.

## Keep linear working color space after the transition probe — slices27–29

- **When:** one-code-value moving transition drift remained after the full-float working-format probe, leaving the Core Image working color space as the next bounded hypothesis.
- **The choice:** temporarily build with `sRGB` working surfaces, compare the same three moving frames, and restore `extendedLinearSRGB` because the probe materially worsened MAE and maximum channel deltas. The probe worker is retained only as evidence.
- **The gap:** the plan delegated the color/compositing cause investigation but did not specify which color-space experiment to run after precision was ruled out.
- **The reach:** future parity work keeps the production color space stable and must investigate another mechanism or revise the independently declared oracle; it cannot hide the mismatch with a tolerance.
- **Verdict:** sound bounded investigation; no shipped renderer change.
- **Confidence:** high for this probe's measured result; low for broader Core Image behavior outside the retained moving case.

## Keep implicit native PNG output after the output-space probe — slices27–29

- **When:** the moving parity drift could also have come from Core Image converting the final image to PNG without an explicit output color space.
- **The choice:** temporarily request explicit RGBA8 sRGB output from `createCGImage`; because the decoded RGB matched the retained production candidate byte-for-byte, keep the existing output path and retain the probe as evidence.
- **The gap:** the plan did not distinguish compositor working color space from final PNG output conversion when assigning the parity investigation.
- **The reach:** future work can focus on blend/source arithmetic or sampling rather than changing PNG output metadata; the strict oracle remains open.
- **Verdict:** sound bounded investigation; no shipped output change.
- **Confidence:** high for the retained three-sample result; low beyond this transition case.

## Keep Core Image's normal source-over operator after the kernel probe — slices27–29

- **When:** the moving mismatch survived working-format, working-color-space and output-space probes, so premultiplied-alpha arithmetic in the built-in normal compositor was the next specific hypothesis.
- **The choice:** temporarily replace normal compositing with an explicit unpremultiply → linear source-over → premultiply kernel. Because all three moving frames were byte-identical to the retained candidate, keep the built-in operator and retain the probe as evidence.
- **The gap:** the plan named blend arithmetic as an open cause but did not prescribe whether an explicit kernel should replace the platform operator.
- **The reach:** later parity work must investigate source decode/sampling or quantization rather than adding a second compositor that has no measured benefit.
- **Verdict:** sound bounded investigation; no shipped renderer change.
- **Confidence:** high for the retained three-sample result; low beyond this transition case.


## Keep source-rasterization materialization after the direct-surface probe — slices27–29

- **When:** working format, working color space, output color space and source-over arithmetic probes did not explain the moving mismatch, so the per-source `CGImage` materialization was tested next.
- **The choice:** temporarily compose decoded movie `CIImage` surfaces directly. The three-sample receipt did not pass the strict oracle and worsened the first sample's maximum channel delta to `2`; keep the existing materialization path.
- **The gap:** the plan left source decode/materialization as a possible cause without prescribing a bounded probe.
- **The reach:** future parity work should investigate source decode or sampling rather than removing the shared source-picture color preparation.
- **Verdict:** sound bounded investigation; no shipped renderer change.
- **Confidence:** high for the retained three-sample result; low beyond this transition case.
