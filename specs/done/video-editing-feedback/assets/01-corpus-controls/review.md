# Scoped review

## Shape and ownership

`corpus-controls.mjs` owns only the independent-control checkpoint. It reads
the existing canonical media owner and does not add a fixture copy, service
launcher, product operation or compatibility path. The feature manifest owns
the control oracles and hashes; source fixture metadata remains with the
canonical corpus.

## Diff review

The verifier checks every declared media hash/size before decoding, validates
the declared audio landmarks, rotated stream metadata, alpha coverage, odd
canvas dimensions, edge landmarks, video-only stream absence, transition-gap
timestamps, and every hand-authored clock/text/blank oracle. The companion test
proves a changed oracle fails with `CONTROL_CHANGED`. No implementation answer
is imported as an oracle.

## Documentation review

The slice, evidence index, traceability row and choices ledger identify this as
a scoped independent-control pass. The receipt states the nine controls and
594,411 bytes while keeping real-media, multicamera and speaker gates open.

Focused checks: `node --test packages/test-harness/editing/corpus-controls.test.mjs`
and `node --test packages/test-harness/editing/video-corpus.test.mjs
packages/test-harness/editing/corpus-controls.test.mjs` (17 passing tests).
