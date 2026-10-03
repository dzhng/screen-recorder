# Preserve contracts through owner removal

Removing an obsolete owner must preserve the guarantees it happened to exercise.
Current source/project owners carry those guarantees; an old wrapper stays only
while it has an identified consumer or unmatched contract. A wrapper calling
another wrapper is insufficient reason to retain either.

The [publication map](publication-contract-map.md) separates useful publication
and lifetime guarantees from retired recording-edit policies. Historical
[source/service](service-dependency-audit.json),
[native](native-consumer-audit.json), [matched native](native-guarantee-map.json)
and [caller](caller-cutover-audit.json) maps locate remaining dependencies. They
are source audits, not runtime results or deletion certificates.

## Evidence by contract

Each report identifies exact source operands, its adjacent evidence archive and
scope. Original failures remain distinct from repaired outcomes. Transcribed
observations are labelled separately from contemporaneous process journals;
controlled replies prove their contracts without becoming decode or quality proof.

| Contract | Canonical evidence |
| --- | --- |
| Archive admission, borrower drain and namespace ownership | [Registry](registry-verification.json), [package owner closure](package-owner-closure-verification.json) |
| Publication, acknowledgement loss and private retirement | [Publication](publication-verification.json), [lifetime](publication-lifetime-verification.json), [package publication](package-publication-verification.json), [abandonment](package-abandon-verification.json) |
| File containment, inherited writers and exact source authority | [Boundaries](package-boundaries-verification.json), [reader](project-archive-reader-verification.json), [extraction](project-archive-extraction-verification.json) |
| Pinned exports and retained portable generations | [Pinned retry](publication-pinned-verification.json), [generation retention](package-generations-verification.json) |
| Capture/source lifetime and recovery | [Capture lifetime](capture-lifetime-verification.json), [source facts](capture-source-verification.json), [deletion](captured-source-deletion-verification.json) |
| Public capture and default-service composition | [Capture service](capture-service-verification.json), [delivery/storage](capture-delivery-storage-verification.json), [project startup](project-startup-verification.json) |
| Shared source evidence, caches and jobs | [Cache](source-cache-verification.json), [scene facts](source-scene-verification.json), [evidence fixtures](source-evidence-fixtures-verification.json), [queue](source-project-jobs-verification.json) |
| Source normalization and common movie receipts | [Source export](source-export-verification.json), [movie validation](rendered-movie-verification.json) |
| Public project package ownership, media and discovery | [Package media](project-package-media-verification.json), [public detail](project-package-public-verification.json) |
| Canonical service framing, replay and source/job continuity | [Public service](public-service-contracts-verification.json) |
| Generic render cancellation, worker drain and consumption | [Render lifetime](generic-render-lifetime-verification.json) |
| Selected-source transcript processing and project projection | [Transcript owner removal](transcript-owner-purge-verification.json) |
| Source/project scene and index execution | [Producer removal](scene-index-owner-purge-verification.json), [index policy](index-policy-verification.json) |
| Retained PNG ownership, paging and managed portable adoption | [Generic index removal](generic-index-owner-purge-verification.json) |
| CLI/MCP media owner validation and complete selection delivery | [Batch delivery](batch-owner-contract-verification.json) |
| Current native frame/audio wire contracts and bounded grid | [Native source contracts](source-native-contracts-verification.json) |
| Owned imported media and cursor decode clock conversion | [Native consumers](source-native-consumers-verification.json) |
| Descriptor release and observed unfinished work on parent death | [Native lifetime](source-native-lifetime-verification.json) |
| Source-picture orientation, fidelity, byte bounds and aliases | [Raw pictures](source-native-pictures-verification.json) |
| Portable scene semantics, orphan carrier closure and source-cache scale caller | [Current owners](source-cache-carrier-closure-verification.json) |
| Delivered cursor/trail readability and crop sizing | [Compiled pictures](composition-pointer-readability-verification.json) |
| Caller-selected cuts, source/project clocks and adopted inspection | [Explicit caller](personal-release-caller-verification.json) |
| Independent source-frame failures, retry and delivery ownership | [Frame owner removal](frame-owner-purge-verification.json) |
| Recorded silence, missing samples and late stream consumer failure | [Native audio](source-native-audio-contracts-verification.json) |
| Resampling exclusion and admitted source endpoints | [Audio endpoints](composition-audio-endpoints-verification.json) |
| Current movie lifetime and scale caller contracts | [Movie caller ports](movie-harness-cutover-verification.json) |
| Explicit audio/preview inspection and shared render consumption | [Audio/preview owner removal](audio-preview-owner-purge-verification.json) |
| Capture facts without recording edits, source jobs and prior-catalog refusal | [Core/schema](core-owner-verification.json), [contract map](core-owner-contract-map.md) |
| Current native engines, selected PCM and preserved small movie/picture contracts | [Native owner closure](native-owner-purge-verification.json), [dispositions](native-owner-dispositions.md) |
| Current production worker, source/audio/preview delivery and native cleanup | [Service smoke](current-worker-service-verification.json) |
| One implementation-end repository run, focused recovery and current movie contracts | [Default gate recovery](default-gate-recovery-verification.json) |
| Private donor fixture creation and cancellation ownership corrections | [Capture fixtures](capture-fixture-contracts-verification.json) |
| Current index/cache, source-history cuts and actual worker cancellation | [Current caller fixtures](current-caller-fixtures-verification.json) |
| Long selected PCM, independent frame counts and bounded native memory | [Current streaming scale](current-streaming-scale-verification.json) |
| Orphan acquisition workspace, donor and removal leases across parent death | [Current source lifetime](current-source-lifetime-verification.json) |
| Actual capture, recovery, journal publication and countdown cancellation | [Current capture/UI retry](current-capture-ui-verification.json) |
| Thirty-minute source seek, cache identity, LRU eviction and restart | [Current long-frame cache](current-long-frame-cache-verification.json) |
| Exact soundtrack support without additional PCM or changed packets | [Movie support](movie-audio-support-verification.json) |
| Original short/long movie duration, phase, pixels and native memory gates | [Current movie scale](current-movie-scale-verification.json) |
| Complete raw-source scene/index publication, paging and retained PNG growth | [Current complete index](current-complete-source-index-verification.json) |
| Owned staging replacement, common publication and rebuilt release tiny movie | [Staged output ownership](staged-output-ownership-verification.json) |
| Deep/wide 10k-project placement invalidation, pinned queries and undo | [Current reorder query](current-reorder-query-verification.json) |
| Aligned/fractional SDK finishing cancellation and native error classification | [Current finishing](current-movie-finishing-verification.json) |
| Muted retained-media native playback, exact endpoint and teardown | [Current continuous player](current-continuous-preview-verification.json) |
| First sibling video error, actual unfinished audio and bounded drain under controlled readiness | [Controlled sibling pumps](sibling-pump-controlled-verification.json) |
| Current white-pointer move/hold over a held source picture | [Current moving pointer](current-moving-pointer-verification.json) |
| Native first-frame decode versus the saved PNG surrogate, diagnostic only | [Native color-path qualification](current-native-movie-color-verification.json) |
| Current fixed full/clipped fading trail at matched source clocks | [Current colored-trail pair](current-colored-trail-verification.json) |
| Current combined long-project query, late audio, queue/restart and warm preview | [Combined scale](current-combined-scale-verification.json) |
| Private installed cold default discovery, CLI/default MCP and personal-state protection | [Installed discovery](current-installed-discovery-verification.json) |

[Capture/source caller ports](capture-source-caller-verification.json) and their
[review corrections](capture-source-caller-followup-verification.json) and
[integration](capture-source-caller-integration.json) bind the remaining
source, capture, recovery and pointer callers to current acquisition/project owners.
Their syntax, compile-only linking, unchanged pure presentation algorithms and
three current-owner metrics cases pass;
subsequent default recovery and current-caller banks own their actual runtime
verdicts. The current-source-lifetime bank closes the three retained orphan
workspace/donor/removal cases. The capture/UI retry bank closes its thirteen
named failures and actual frame prefix. Current movie scale and complete raw-source
index now pass in their separate banks. The staged-output bank closes replacement
cleanup/publication and the combined release tiny movie. The current finishing
bank closes qualified SDK cancellation; the player bank closes muted continuous
progress/end/teardown. The sibling bank exercises actual SDK refusal with
unfinished audio under declared controlled readiness, not natural scheduling.
The pointer bank accepts three no-trail white-pointer samples. The colored-trail
bank accepts only the fixed full/clipped pair through the unchanged native-sRGB
predicate and fresh matched-frame critique; original historical failure and both
setup-only refusals remain. Its private layer tag and current explicit encoder
defaults are disclosed, not historical encoded-byte equivalence. Observed
movie/PNG color parity, general gestures, listening and installed scope remain
unresolved. The native first-frame diagnostic supports a saved-PNG
surrogate contribution to the observed dark background; it does not approve
general color equivalence or establish player display.
Historical lab commands in the recording spec are
retained evidence, not runnable current entry points.

## Ownership and proof limits

Capture creates source facts; projects own edits. Deleting a capture does not
retire an independently managed asset or project. Adoption creates a fresh
recipient whose owned bytes survive donor removal. Source data mentioning a
recording is not thereby an edit interpreter; trace its actual consumers.

Portable resources keep the current authority and validation owner. Retaining an
unconsumed page format solely for a test would create another representation to
maintain. Generic index and scene resources use managed portable source
generations. Their semantic and continuity oracles run at the current staged
store; standalone scene/event page formats and their orphan adapter are removed.
Shared raster and pointer algorithms keep their existing owners.

Controlled metadata and fixed valid PNGs establish ownership, paging and refusal.
Actual worker checks establish only their named decoder, pixel or lifetime scope.
A test executable is distinct from the production worker; a default-entry bundle
is compilation proof, not app launch. Native source hashes bind use of a preserved
worker. Changed native code requires corresponding new execution evidence.

Abrupt worker death can leave private staging for its caller to remove. The
parent-lifetime contract promises no final publication or reply; it does not
promise Swift defer execution after a hard exit. Generic descriptor lifetime
remains live even where the retired PNG input/output handle pair has no caller.

The current compositor supplies actual delivery reduction and visible source
geometry to the existing cursor/trail sizing owner. Complete comparisons preserve
full-size and clean output; tight crop glyphs match the established reference but
remain difficult to recognize at 32 pixels. No new sizing recipe is introduced.

Recording frame/materialization/selectors are removed after their useful checks
move to current source/project owners. Service batches isolate bad admissions,
unreadable cached items and failed jobs without starving valid siblings. The
native sparse/index callers retain their actual pixel and cache gates; the
current-caller bank executes them against the isolated built candidate. Its
generated frame control remains separately labelled; the capture/UI retry bank
now also executes the physical source prefix and the same authored crop/delivery
contracts, without claiming visual readability or physical marker precision.

Focused native audio checks preserve physical occupancy, exact PCM and late
consumer failure. Composition resampling preserves admitted boundary impulses
while excluding adjacent samples. These checks use current test executables;
they do not establish whole-movie or production-worker acceptance.

Movie lifetime and scale callers now compile explicit composition clips and
gains. Their duration, AAC phase/error, pixel, source-byte and memory assertions
remain runtime gates. Generated timing and lifetime execute in the default
recovery bank. Selected streaming passes its long gate separately. The current
movie-scale bank now preserves exact soundtrack support and original PCM count,
with unchanged error/memory limits. Its analytic signal oracle derives source
sample positions from authored floor clocks rather than unquantized offsets.
Recovered in-process finishing hooks document a historical
phase contract; a current process-abort check is not equivalent evidence.

Audio and preview callers now author explicit source/project targets. Recording
audio, preview and derivative owners are removed. Current preview tests preserve
explicit retry without polling-triggered retries; generic render file and attempt
lifetimes remain unchanged. Forty earlier current-owner cases, one final relocated
report case and sixteen controlled render cases pass. The service smoke below owns
subsequent actual media and cleanup execution.

The [core/schema closure](core-owner-verification.json) removes those orphan
processing/span owners and the actual recording revision field. Prior-format
refusal preserves a real old catalog byte-for-byte. Current capture responses,
source job identity and the surviving pointer schedule pass focused checks.

The native owner bank removes four recording render operations while preserving
current source/composition engines. Exact picture and selected PCM comparisons
and small movie controls retain their named scope. The current service smoke
also executes source restart, audio and preview delivery and two native cleanup
cases. Receipt clocks and path identity follow current contracts. Source-attached
pointer history survives cuts and trims; source pauses still reset held state.

The default recovery bank executes current generated movie timing, cancellation
and process lifetime; exact SDK finishing stays separately qualified. Remaining
obligations include remaining integrated scale dimensions and release scope.
Staged-output cleanup and publication now retain directory identity; their bank
records the one-parent scan and external writer leaf limits. The explicit caller
harness uses current operations through controlled
replies. Installed switching, broader continuous A/V presentation, physical capture
and speech/listening acceptance remain separate release gates. No source recording
or accepted audition is changed by these fixture ports.
