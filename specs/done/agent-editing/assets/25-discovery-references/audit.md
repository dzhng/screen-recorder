# Shared-reference discovery audit

Scratch-only investigation against current main `0552f070`; installed Zod4.6.5
and MCP SDK1.30.0. No production edits, builds, service/app launch, native work or
new validator. The only CLI executions were source `--help`, whose early help
branch performs no service request.

## Recommendation

Add `reused: "ref"` at the existing `capabilities()` owner in
`apps/cli/src/main.ts`, preserving `io: "input"` and the current override that
removes `readOnly`. Keep the complete generated schema, including each operation's
local `$defs`, in both CLI help and MCP tools/list. Do not introduce another help
flag, compact hand-authored schema, global definition registry, runtime validator
or omission of advanced settings.

This is a small worthwhile discovery change, not a claim that every external
client handles references correctly. Follow it with a bounded fresh public consumer
trial before declaring usability solved.

## Measured size (UTF-8 bytes)

| Actual schema/help shape | Current inline | Shared refs | Reduction |
| --- | ---: | ---: | ---: |
| Selected `edit.apply --help`, complete existing wrapper |454527|68769|84.87%|
| Whole `--help`, complete existing wrapper |761493|339925|55.36%|
| Compact78-operation catalog, without help wrapper |204613|140253|31.45%|
| Pretty78-operation catalog, without help wrapper |724784|317832|56.15%|
| `edit.apply` tool object, pretty, without wrapper |418754|59132|85.88%|

Current help differs slightly from the earlier~461KB observation as the live
catalog changes. No pretty-print or help-text changes were used to obtain the
reductions. Small operations sometimes grow:19 compact tool objects gain30–201
bytes from reference overhead; the large edit schema dominates the net saving.
This is not a universal per-operation compression claim.

## Closure and semantic inspection

Generated all78 actual operation schemas from `operationSchema.options` with the
existing override and input mode. The referenced catalog contains795 `$ref`
occurrences and242 `$defs` entries in total. Every reference resolves within its
own `inputSchema`; zero dangling/external refs, cycles or `readOnly:true` remain.
No cross-operation reference sharing is required. Extracting one selected tool
with its complete inputSchema remains sufficient.

A recursive local-ref expansion found structural equality for75 operations. The
other three (`project.create`, `edit.apply`, `text.seed`) differ only at70 nodes:
ref expansion contains an additional `minimum:0` while both forms already have
`exclusiveMinimum:0`. The lower bound is redundant under the emitted JSON Schema
2020-12 semantics. No enum, required/default status, property, numeric upper bound,
additionalProperties, union branch or description was otherwise changed. Do not
claim raw expanded-JSON byte equality; preserve this explicit finding instead of
patching generated schemas to look identical.

All78 operations retain the same immediate root `required` or root `anyOf[*].required`
values. The current `expectCallableContract` helper in `apps/cli/src/main.test.ts`
therefore still observes its asserted shape, including defaultable params remaining
optional. Its recursive serialized readOnly check also remains valid. A repository
search found no other production consumer that manually traverses discovered
inputSchema properties or strips `$defs`; arbitrary external consumers remain an
unmeasured boundary. JSON Schema already cannot express every Zod refinement;
that pre-existing discovery/runtime distinction is not changed or solved here.

Full settings remain advertised. Reference expansion preserves every existing
property/constraint except the redundant lower-bound spelling above. Encoder,
look-ahead and other output controls still occur in the generated documents; no
field matrix or enum is hidden to achieve the smaller size.

## SDK and consumer compatibility

The actual installed `ListToolsResultSchema.safeParse` accepts all78 proposed tools
with the production MCP wrapper's `type:"object"`. Comparing parsed inputSchema
objects to supplied objects proves the SDK preserves `$defs`, `$ref` and all other
keys unchanged. Its ToolSchema uses a catchall for additional schema keywords and
identifies its contract as JSON Schema2020-12. This establishes SDK envelope
compatibility, not an external model/provider's schema-subset support.

Important boundaries:

- Resolve a reference against that tool's **inputSchema**, not the outer CLI help
  object or entire tools array. Copying only `properties` loses the definitions.
- `$ref` siblings must retain standard2020-12 meaning; do not replace references
  with a home-grown flattening routine in production. My expansion was a bounded
  audit comparison, not a proposed runtime validator.
- Definition names such as `__schemaN` are generated implementation details.
  Clients/tests must not key behavior to their ordering or names.
- The existing `io:"input"` and readonly-removal override remain necessary;
  omitting them could make defaulted inputs required or advertise runtime freezing
  as an authoring restriction. The proposed option does neither.

## Small next pass

One production option change at the common CLI/MCP owner. Use the existing CLI
contract tests to assert selected help and tools/list still publish a complete,
locally resolvable schema, optional defaults and writable inputs. Check actual
ToolsListResult parsing without adding a second validator or snapshotting generated
definition names. Retain representative full-setting fields in that check; a size
budget is diagnostic, not permission to remove capability.

Then give one fresh agent only public help for an edit with an advanced nested
processor/output setting. It should discover the referenced shape and issue a
valid request through the existing public surface, with no implementation lookup.
If that client cannot follow local refs, report the concrete client limitation;
do not silently drop constraints or fork the schema owner. No new service/native
build is necessary to establish the metadata change itself.

## Scratch evidence

- `/tmp/screenrec-discovery-reference-probe.mjs`: actual-schema comparison and SDK check.
- `/tmp/screenrec-discovery-reference-measurements.json`: all78 per-operation sizes/closure.
- `/tmp/screenrec-discovery-inline.json`, `/tmp/screenrec-discovery-ref.json`: complete catalogs.
- `/tmp/screenrec-discovery-expanded-{inline,ref}.json`: audit expansions.
- `/tmp/screenrec-discovery-reference-differences.json`: all70 redundant-bound differences.
- `/tmp/screenrec-help-{selected,catalog}-{current,ref}.json`: complete help envelopes.

No service request, applied edit or fresh-agent usability claim is included in this
read-only investigation.
