# Native follow into independent learned processing

This gate joins two existing owners without deriving its oracle from the current
worker. The historical pitch-follow source, dry output and plans are retained in
[the authenticated input archive](retained.tar.xz), with [file identities](retained.json).
The dry PCM is additionally checked against the committed
[14d report](../14d-pitch-follow/follow.json). Current dry execution must match
those frozen samples exactly before learned execution is checked. No tolerance
is inferred from the earlier cross-process converter variation.

The shared frozen C adapter processes the retained dry stereo samples. Native
late delivery runs before full learned delivery and must equal the corresponding
C result; full delivery must then equal the complete C result. A separate C run
starting at the late boundary differs, demonstrating that the earlier history
matters. Substituting that reset expectation deliberately fails the late assertion
after dry parity passes; restoring the complete-history expectation passes.
This is assertion sensitivity, not a production mutation. Each learned request
prepares the complete follow run once in its own native process.

The existing [follow evaluator](../../../../../packages/test-harness/editing/composition-follow.py)
owns this narrow mode. Its default follow matrix is unchanged. The existing
native fixture runner adds real-wire delivery, and the existing shared C adapter
continues to own recipe checking, lane handling and delay compensation. No
production behavior, model or schema changed. The original runner transport also
passes a focused dry regression.

This is native execution evidence only. It does not establish public combined
follow delivery, natural speech quality or listening acceptance. The historical
source and placement use rational clocks that public integer-microsecond retime
cannot reproduce merely by rounding. A public join needs an independently
verified dry follow pair with exactly authorable clocks, or a separately proven
exact transformation of this pair. The full quality gate remains open.

[Verification](verification.json) pins commands, workers, source code and archives.
The evidence archive retains final requests/responses and PCM, C inputs/raw
outputs, the reset-expectation failure, and source snapshots. The input archive
makes the old temporary paths historical provenance rather than replay dependencies.
The narrow invocation takes the actual native worker and `--learned-reference`;
the default invocation continues to take the native composition test worker.
