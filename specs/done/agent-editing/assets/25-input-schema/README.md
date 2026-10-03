# Callable input schemas

The [fresh gain consumer](../16-gain-skill/REPORT.md) found required authored curve
keys marked read-only. Zod4.6.5 emits that annotation for runtime-frozen arrays
even in input mode. The shared CLI/MCP capability generator removes readOnly
annotations using Zod's export override; parsed array freezing and all input
validation constraints remain unchanged. No second schema or public flag is added.

The public discovery assertion fails on the old CLI catalog, then passes for
CLI help and real MCP tools/list after the correction. Existing optional/default
and offline-discovery assertions remain. Focused build and independent static
review pass; the review verified override ordering after inherited schema fields.
This is a discovery correction, not a change to gain execution or immutable
caption provenance.
