# Retained verification evidence

These packets preserve original inputs, observations and acceptance limits.
An old pass establishes its recorded claim; it does not certify the current build.
Reports, manifests, original media and independent reference operands remain
unchanged so current verification can reuse their authority.

Completed one-run producers and copied implementations are retained in
[the source snapshot](https://github.com/dzhng/screen-recorder/tree/c08e0bd8e10903d482232818ccfffaf1d653555a/specs/done/agent-editing/assets).
Use that revision when a frozen report names a producer no longer in the working
tree. Its recorded path and digest describe the original run, not a missing
current prerequisite. Recovering its source does not authorize rerunning capture
or inference.

Restore utilities and saved-output validators stay beside the evidence they
interpret. They recover deduplicated bytes or verify what a historical result
actually proved. Independent reference media, annotations and model/runtime inventories stay
here when their original identity is part of the comparison.

[Current verification tools](../../../../packages/test-harness/README.md) own
future regression checks. Read a runner's scope before invoking it: a matched
historical measurement may deliberately require its original runtime, while
a current integration journey admits fresh identities through the product.
