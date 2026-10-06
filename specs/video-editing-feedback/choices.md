# Implementation choices

User decisions remain binding; this ledger records implementation discretion outside the approved plan.

## Preparation boundary — sound, high confidence

The user clarified that pinned models for first-class Yap features, specifically Parakeet, should download/prepare as needed by default. The recommendation-only policy applies to capabilities outside Yap. Preparation remains an explicit operation through the existing model owner; ordinary inference stays offline. This supersedes the broader wording in the original plan.

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
