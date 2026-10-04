# Capture reference surface

The workbench is a local page for producing distinguishable visual, pointer and
speech observations. It is a recording target, not an editing UI or product feature.
The [page source](public/) owns its landmarks and interactions; the
[package manifest](package.json) and [server](server.mjs) own launch and routing.

Repeatable landmarks let a capture or geometry check compare observation with
intent without relying on a changing external website. Synthetic mechanics cannot
establish human narration quality. The [retained real take](../../fixtures/narrated-workbench/README.md)
provides that separate input and should be reused when its evidence still applies.
