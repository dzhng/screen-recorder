# RNNoise native dependency

This package owns the fixed learned mono frame adapter. The
[native audio owner](../mac/Sources/YapAudio/README.md) supplies selected
state domains and consumes paired channel output through managed preparation.
The dependency has no project, channel-selection, model-download or publication
authority.

[Provenance](provenance.json) binds vendored source and generated-model inputs.
[Preparation](prepare.mjs) verifies and stages generated C in ignored build storage;
it never converts or downloads weights. The [app builder](../../scripts/README.md)
checks that prerequisite before native compilation. Runtime processing cannot
silently prepare missing weights.

The adapter streams bounded frames while retaining state across chunks. The caller
declares finite input and owns transactional cleanup on read, write or cancellation
failure. Preview bounds do not redefine the learned-state origin.
[Retained parity evidence](../../specs/done/agent-editing/assets/15a1-denoise-entry/README.md)
and [verification tools](../../packages/test-harness/editing/README.md) distinguish
fixed-recipe identity from routing, delivery and listening quality.

Retain the vendored [COPYING](COPYING) notice with redistribution. The pretrained
model's license has not been explicitly clarified upstream; local execution and
source-code licensing do not imply a confirmed weights-license grant. Model
provenance preserves that limitation rather than silently resolving it.
