# Pointer alpha geometry checkpoint

The public journey isolates pointer support by making the underlying footage
transparent before the pointer step. This preserves the native pointer branch
instead of flattening pointer and footage into an invalid RGB reference. The
independent inverse-sampling oracle compares the entire alpha plane; native
compiled transforms are not used as expected geometry. RGB/profile and encoded
movie gates remain separate and unchanged.

Run from the repository root with an isolated native binary:

```sh
SCREENREC_NATIVE=/path/to/screenrec-native node packages/test-harness/editing/pointer-geometry.mjs --out /tmp/fresh-pointer-geometry
```

The frozen [report](report.json) records public receipts and file hashes. It
covers two canvases, contain/cover/stretch, successive clip geometry, track,
nested groups and output. The 48 intermediate/whole-chain alpha comparisons
have maximum error 1 against the original 2-code-value pixel budget. Each
comparison rejects a coherent one-pixel horizontal shift and a missing pointer.
The 24 opaque output rotations match independent pixel reversal exactly and
reject an omitted rotation. All 100 native PNGs are in [images](images).
Expected alpha buffers are gzip-compressed beside their images.

This is a measured PNG geometry checkpoint with [fresh visual review](review/status.md),
not a new movie profile. [Root integration](root-integration.json) reproduces
all 100 captured PNGs on the combined worker. The full capture set, full-view
sheets and 4x feature crops are in [review](review). The source contains a small
cursor whose repeated fractional resampling visibly softens its border and
trail; the alpha gate does not certify sharpness or color fidelity.

A prior run ended with the native frame worker's typed deadline failure after
its first case. [That report](timeout-report.json) and its service log are
retained; no deadline or retry policy was changed. The successful run completed
sequentially, which is not evidence of the failure's cause. An earlier harness
request included an unknown metadata field and was corrected before measured
execution. Shared fixture extraction initially omitted a later consumer's
`records` binding; the subsequent [original journey](preservation-report.json)
completed successfully with its existing assertions intact.

Native binary used: `/tmp/screenrec-project-image-integrated-native`, SHA-256
`2b40350219d91abdb79d0872d2fa34aff64be0d60a711cacf3724d06749c0db2`.
The renderer and production paths are unchanged. For the unresolved encoded
trail/color evidence and the disproven flattened reference, see the
[separate controlled experiment](../15-pointer-chain/README.md).
