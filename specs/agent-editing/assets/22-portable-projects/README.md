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

This checkpoint requires the current revision. Retained scene/transcript/index
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
