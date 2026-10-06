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
- **The reach:** Validation rejects foreign/unknown/repeated members, non-media clips, origins outside the group and ranges outside the resolved clip interval. The relationship can survive ordinary placements without adding a second timeline, while slice20's failed waveform hypothesis still blocks promotion and switched-view delivery.
- **Verdict:** sound, medium confidence. The data owner is explicit and hard-cutover friendly, but sync evidence and native replay remain unfinished.
- **Confidence:** medium.

## Transition recipe lowering — slice27

- **When:** slice27 public composition checkpoint.
- **The choice:** Keep transitions as caller-authored convenience operations that lower to the existing gain and opacity processors. Crossfade names two distinct targets and emits opposing ramps; dip and flash name one target and emit a three-point pulse. A project/source pulse must have an even whole-microsecond midpoint, while clip anchors retain exact fractions. The recipe does not add assets, retime media or synthesize an SFX/color layer.
- **The gap:** The transition request needed a reusable public seam but the native graph already owned all required scalar execution. Adding a second transition renderer would create a second clock and duplicate alpha/audio behavior.
- **The reach:** Public composition tests prove the authored curves and explicit midpoint refusal. The canvas/background or caller-selected overlay controls the visible dip/flash color; delivered native transition evidence and motion critique remain open.
- **Verdict:** sound, medium-high confidence. The lowering is small and shares the existing processor/executor contracts, but visual/audio delivery still needs its own evidence gate.
- **Confidence:** medium-high.

## Bounded tonal recovery owner — slice25

- **When:** slice25 composition/native parameter checkpoint.
- **The choice:** Extend the existing ordered source-neutral SDR correction with bounded `shadows` and `highlights` fields and lower them through the same native Core Image executor after temperature, exposure and color controls. Keep identity at zero and preserve the existing extended-linear-sRGB/alpha behavior.
- **The gap:** The feedback asked for tonal controls, but adding a separate grade processor would duplicate working-space, ordering and native readiness ownership.
- **The reach:** Callers can make explicit wall/face corrections without an automatic face grade. Curve, split-tone, reference-conditioned picture evidence and native visual acceptance remain open.
- **Verdict:** sound, medium confidence. The shared owner is clear and focused checks are green, but the native grade still needs frozen reference receipts.
- **Confidence:** medium.
