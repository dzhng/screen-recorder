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

This checkpoint supports asset-only projects at their current revision. Capture
acquisitions and retained source/project evidence generations are explicitly
refused until their owning stores support portable adoption. Prepared model-dependent
outputs, fonts and actual 15a output remain [slice 22](../../slices/22-portable-projects.md)
acceptance. Native media equality does not close listening or physical-camera gates.
A fresh autonomous skill trial remains a separate acceptance check.
