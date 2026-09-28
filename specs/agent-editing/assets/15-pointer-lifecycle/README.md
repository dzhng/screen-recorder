# Public pointer edit lifecycle

A pointer effect follows the selected acquisition's immutable source history.
Changing a binding must preserve compatible processing settings without reusing
observations from a different acquisition. A trim changes the visible interval,
not the history available to its trail; a held tail freezes both footage and the
pointer's requested source instant.

The [public journey](../../../../packages/test-harness/editing/pointer-lifecycle.mjs)
uses actual CLI/MCP requests and native PNG delivery. Run it with a matched
service/native build:

```sh
SCREENREC_NATIVE=/path/to/screenrec-native node packages/test-harness/editing/pointer-lifecycle.mjs --out /tmp/fresh-pointer-lifecycle
```

The frozen [report](report.json) passes all six check groups and retains all 54
image receipts/hashes in [images](images/). A second acquisition shares the same
media asset but carries a visibly different pointer path. Replacement selects
that path while preserving step IDs/settings. Removing the acquisition rejects
the entire batch with either enabled or disabled pointer processing; explicit
reset matches an independently created raw-footage project. Held padding matches
an explicit hold reference and trimmed pictures match untrimmed source history.

Separate processing edits on clip, track, both nested groups and output each
visibly change the image. Undo reproduces the prior image and document; restore
and historical reads reproduce the changed image. Cross-transport replay returns
the same receipt, including after undo, without advancing the current head.
Wrong-acquisition, reset-no-op, advancing-hold, omitted-trail and processing-no-op
controls are visibly distinct from their positive references.

These are exact PNG lifecycle comparisons. They do not certify encoded movie
color, compression, playback motion or audio. A fresh reviewer inspected the complete set and found no definite rendering
defect. The [review disposition](review/status.md) retains readability limits
and the sheet-label concern with measured counterevidence. This is scoped PNG
lifecycle acceptance; the complete views and 4x feature crops remain available.

The first incompatible-edit assertion incorrectly expected the internal
`INVALID_COMPOSITION` error at the public boundary. The API correctly returned
`INVALID_EDIT` with that internal cause and the pointer diagnostic. The retained
[failed assertion report](public-error-contract-report.json) distinguishes this
harness correction from a product defect. No production code changed.

Native binary used: `/tmp/screenrec-project-image-integrated-native`, SHA-256
`2b40350219d91abdb79d0872d2fa34aff64be0d60a711cacf3724d06749c0db2`.
The coordinator's newer service/native combination still needs its integration
run. The earlier [geometry reference](../15-pointer-alpha/README.md) and
[encoded color investigation](../15-pointer-chain/README.md) keep their own gates.
