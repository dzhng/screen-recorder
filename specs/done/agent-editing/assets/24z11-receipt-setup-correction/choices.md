# Receipt correction choice

**Sound — high confidence: use the runner's setup lifecycle for fixture creation
and SDK connection.** During root integration, the receipt test reached its
5-second deadline while preparing the fixture, starting its service, initializing
the SDK and checking complete operation bytes. The phase probe measured 2,945 ms
of preparation before the first operation. The correction prepares those same
inputs in the existing 10-second setup hook; the original 5-second body still
executes and verifies every real operation and complete byte comparison. Moving
operations or comparisons into setup would hide their verification cost, so they
remain in the body.

The original plan did not choose a test lifecycle boundary. This decision gives
fixture initialization and consumer behavior their existing runner budgets without
increasing either. It constrains future changes to keep operation, artifact-read,
CLI and equality oracles in the test body. The scope is test setup only; no
production latency or performance improvement is claimed.
