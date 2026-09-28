# Portable project archive checkpoint

The [public fixture](../../../../packages/test-harness/editing/package.mjs) passed on
2026-09-28 through actual CLI children, MCP stdio and the production native worker.
The isolated donor library, imported source paths and opened ZIP were removed
before verifying independent adopted playback and undo. [Report](report.json)
retains transport activity, exact decoded RGB/WAV hashes and failure checks; the
adopted current and historical movies/WAVs retain the delivered media.

The dependency fixture marks one imported movie as generated and gives it an
owned reference-audio asset. It proves reference closure and byte preservation,
not synthesis quality. Current and historical documents, active undo and source
bytes survive relocation. Reopening the same package replays adoption without
creating another project. Corrupt and missing members fail; cancellation after
real asset copying exposes no project or asset rows, and startup recovery removes
unpublished files. That cancellation uses a timing barrier around the real asset
copy result, without replacing media or publication behavior.

A public large-history case crosses the extractor's aggregate revision budget and
is refused before publication. Closed admissions remain inspectable as terminal
receipts. Existing archive writer/registry tests (24) and native parser/adversarial tests (43)
also pass their bounded pool, path/hash/size, partial-copy cancellation, retained
handle and recovery checks. Core tests (11), focused service/dispatcher tests (16),
protocol tests (19), and core/protocol/service type checks pass. Independent review
findings about aggregate metadata limits and terminal admission status are fixed
with public regressions; the final review found no actionable regressions. Its
broader service run was blocked by sandbox socket permissions, so the service
counts here come from the separately executed focused checks.

Run with a frozen native worker and isolated scratch homes:

```sh
SCREENREC_NATIVE=/path/to/frozen/screenrec-native node packages/test-harness/editing/package.mjs --case relocate-edit-undo
```

Acquisition dependencies preserve the original acquisition/source/generation IDs,
all bindings, exact journal bytes and exact normalized evidence. The public fixture
imports a labeled synthetic journal through the real native importer, uses its
acquisition only in a historical revision, and compares raw cursor rows after
relocation. It does not claim live capture quality. Asset and acquisition metadata,
references and editable history publish together after file staging; failed staging
and restart recovery retain no visible partial acquisition. Existing identities
require matching provenance and byte hashes. Case-insensitive path collisions are
rejected, and cleanup only removes an exclusively created acquisition directory.

The acquisition pass has 13 focused core tests and 16 focused service tests green;
the wider affected-owner run passed 95 tests before the final collision fixes.
Independent review found the case-colliding UUID cleanup issue, now fixed with
regressions; a second static review found no actionable defects. Its earlier broad
core run encountered timing failures and is not counted as passing. The public
run also caught persisted-pin serialization, strict descriptor and zero-origin
clock issues; all are corrected and the final relocation run passes.

Retained source-scene generations carry their original sampler publication identity.
Adoption restores ordinary scene selectors without inventing a local execution;
an imported ready publication has no local job ID. The public journey restarts the
adopted library before its first timeline inspection, then verifies ready scene
rows and unchanged current/historical decoded media. A focused historical-sampler
case preserves two implementations through restart without sampling. Export intents
retain immutable generations until publication or abandonment; archive payload work
runs in the heavy queue, with aggregate metadata and entry limits checked at pinning.

The scene pass has 84 focused queue/scene tests and 16 focused service tests green.
Static review found orphan pending generations, cancellation starvation, premature
payload inventory, and historical sampler/publication lookup defects; recovery,
event-loop cancellation and historical identity regressions cover the fixes. The
final review found no actionable defects. An earlier concurrent large-history test
timeout is retained in the scratch log; the unchanged test passes after native work
ends. The final public fixture uses the reviewed code and passes after relocation
and receiver restart.

This checkpoint requires the current revision. Retained transcript/index
generations are explicitly refused until their stores and queue publication owner
support atomic portable adoption. Prepared model-dependent outputs, fonts and
actual 15a output remain [slice 22](../../slices/22-portable-projects.md) acceptance.
Native media equality does not close listening or physical-camera gates. The full
acquisition/evidence autonomous skill journey remains open.

A [fresh autonomous package/fade skill trial](../22-package-fade-skill/README.md)
now verifies export/adoption and continued editing, retaining workflow and handoff
errors separately from the verified result.

Earlier asset-only root integration reproduces every public check and the current/historical decoded
RGB and WAV hashes on the combined worker. Service (16), protocol (19), and core
(11) checks pass. The first core run retains a five-second large-history deletion
timeout during a concurrent Swift build; the unchanged confirmation passes after
the build. This is not evidence of a proven timeout cause or a raised limit.
`root-integration.json` and compressed logs retain both outcomes.

Root acquisition integration now reproduces every public check, including source
identities/bindings, exact journal/normalized evidence, current/history media and
rollback/replay. Catalog format 14 is a development cutover with no migration. The
affected core run passes 97 checks and times out one source-WAV check at five seconds;
that unchanged file then passes all 17 checks. Service 16 and the targeted build pass.
Both outcomes are retained; no timeout threshold was increased and its cause is
unproven. `root-acquisition-integration.json` records this scope.

## Combined-build scene verification

The root [integration receipt](root-scene-integration.json) reproduces the complete
public relocation journey with the border-corrected worker. The donor and archive
are removed, the recipient restarts, and its first scene query returns retained
events without preparing them again. Current/history media, source and acquisition
evidence, undo, replay and failure checks remain green. The focused queue/scene
tests pass on the combined build. Transcript/index, fonts and prepared model
outputs remain separate unfinished dependencies.
