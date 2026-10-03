# Shared-reference CLI and MCP discovery

The existing CLI/MCP capabilities owner now emits shared Zod shapes as local references. Full settings, input-mode defaults and the readonly-removal override remain intact. Each operation carries its own complete definitions; consumers resolve references against `inputSchema`, never the enclosing help envelope. No new flag, schema owner or validator was introduced.

Against base `0552f070`, complete selected `edit.apply --help` shrank from 454,527 to 68,769 UTF-8 bytes (84.87%); whole help shrank from 761,493 to 339,925 (55.36%). These are measurements, not budgets permitting capability removal. Small schemas can grow. The [prior audit](audit.md) records the comparison and semantic limits.

All 78 generated input schemas have closed local references: 795 references, 242 definitions, no dangling/external references, cycles or readonly inputs. Installed MCP SDK 1.30.0 accepts and preserves every input schema. Expansion matches 75 operations structurally; the other three retain identical constraints with 70 redundant `minimum: 0` additions alongside existing `exclusiveMinimum: 0`. No other field, default, enum or bound changed. Generated definition names are not a stable API.

## Public consumer evidence

A fresh CLI agent, without implementation access, discovered and constructed a nested animated geometry request from public help. That candidate was retained before any successful service capability query. After socket access was available, it submitted the same processor/window through public `edit.apply`; public revision/processing reads and a separate public readback preserved the exact curve. The agent also used public `processing.capabilities`, so this is public-discovery-only proof, not a claim that its entire session used only help.

The initial brief incorrectly requested a rectangle source that help does not advertise; the agent identified that limitation. Initial service calls failed with sandbox `EPERM`. Both failures and the corrected bounded continuation are retained. The successful check authored output-target geometry in an empty project and inspected stored values. It proves nested discovery and authoring, not rendered visibility, motion, listening or whole-workflow acceptance. No personal library, capture device, model or native processing was used. The scratch service was stopped.

## Verification and decisions

The CLI dependency build, CLI typecheck and three focused help tests pass (17 unrelated tests skipped). Existing tests now check reference closure, complete selected help and CLI/MCP input-schema parity while retaining default/readonly checks. Removing `$defs` from the built MCP response made the test fail; restoring the exact bytes made it pass. No mutation is retained. Independent `codex review` found no actionable defects and repeated build/help checks; its attempted full suite was limited by sandbox Unix-listener `EPERM`. No broader-suite claim is made.

The production choice is one `reused: "ref"` option at the shared owner. Existing protocol schemas remain authoritative. The tests assert consumer-visible closure and parity rather than generated names, definition counts or size snapshots. Installed SDK and this fresh agent are verified; other external client/provider schema subsets remain unmeasured. JSON Schema still cannot express every existing Zod refinement.

`evidence.tar.xz` retains full before/after schemas, measurements, probe scripts, actual help, test/build/review logs, original consumer failures, successful requests/responses and independent confirmation. `SHA256SUMS` addresses the archive; its `manifest.json` hashes every retained member. This is a focused slice 25 checkpoint; the final autonomous journey remains open.

Combined-root confirmation at68eec4d8 rebuilt the CLI and passed the same three
focused tests (two adapter/selected cases, then the registry case separately).
The full87-member evidence manifest and archive hash match. No service/native
worker or full-suite rerun is implied; root logs are retained beside the archive.
