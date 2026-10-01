# Fresh capture coordination evidence

[Verification](verification.json) is the acceptance record for selector-free fresh
capture coordination. It distinguishes actual service/CLI/MCP behavior from the
scripted native controller and media-worker replies. No physical capture, media
parity, completed-stop timing or installed cutover is claimed.

[Public exchanges](public-journey.json) preserve the compiled adapter journey.
[Commands and results](commands-and-results.json) retain the tracer failures,
fixture corrections, restored mutation controls and final focused gates; their
named raw logs are included. The failed preliminary public run retains its own
exchange receipt and is not acceptance evidence.

[Runtime identities](runtime-identities.json) pin the final source and compiled
files. [Review](review.json) records the resolved startup, managed-root and
namespace-collision findings, including the final independent source-only review.
The durable architecture choices live in the [choices ledger](../../choices.md).

[Manifest](manifest.json) hashes every payload and the deterministic
[archive](evidence.tar.gz). The archive contains the same payload bytes as the
loose files, without its own manifest or recursive archive copy. Root integration
and merged verification remain separate from this worktree result.
