# Implementation choices

The user authorized implementation on 2026-10-04 via /goal /implement-spec.
This ledger records decisions outside the frozen plan; delegated internal naming
and fixture selection are discretion, not new product decisions.

## Sound choices

### Verify tools only when explicitly requested

When: slice 02. An agent checking whether the listener is ready should not wait
for the app's media files to be hashed and its tools to start. `service.health`
keeps its existing cheap answer. A separate `service.tools` request checks the
selected installation and returns bundled Node and verified FFmpeg paths.
Putting the expensive checks into health caused ordinary discovery to exceed
its deadline in reproduction.

Gap: the plan did not fix the discovery operation's placement.
Reach: callers explicitly request inventory; native operations remain available
when extra tools are absent. Inventory does not authorize backend substitution.
Verdict: sound; separates readiness from a bounded executable inspection.
Confidence: high.

### Sign private copies and pin their actual bytes

When: slice 02. Signing an executable changes its file contents. Staging first
checks the prepared distribution, copies it, signs that copy and writes a receipt
for the signed bytes. The selected app pins this receipt. The original prepared
distribution stays intact; copying its unsigned hashes would reject a valid
signed app or fail to describe what actually ships.

Gap: the plan required signatures and identities but left their sequencing open.
Reach: source builds and releases share the dependency owner's staging function;
source/recipe identities remain stable while signed executable identities vary.
Verdict: sound; binds discovery to the selected signed package. Confidence: high.

### Discovery reads bounded regular files and owns its probe processes

When: slice 02. If a bundled file is replaced by a FIFO, an ordinary file read
could hang waiting for a writer. Discovery opens without blocking, checks that
the opened object is a regular file, and enforces resource, byte and time limits.
It then probes versions through the existing CLI process owner, which retires
the entire process group before completion or cancellation returns. A generic
subprocess helper previously returned from abort while its child still ran.

Gap: runtime verification limits and subprocess ownership were unspecified.
Reach: discovery cannot hold service capacity indefinitely on these substituted
resources or release capacity while version-probe descendants remain alive.
Verdict: sound; uses the same lifetime contract as managed media execution.
Confidence: high.

### One source-built FFmpeg owner, replaceable shared libraries

When: slice 01. A release needs media executables that work after the app is moved.
The dependency owner builds FFmpeg 9.0.2 from a checksum-pinned official archive,
with shared libraries (separate replaceable library files), macOS system frameworks
and no automatically discovered Homebrew dependencies. Matching sources and the
build controller accompany the distribution. A static binary would hide the
libraries inside each executable and complicate replacement/relinking obligations.

Gap: the plan selected broad LGPL-compatible bundling but left version, linking
and source-delivery packaging to the reproduction.
Reach: future release and runtime paths consume this single prepared distribution;
a new external dependency requires a new recipe and affected re-verification.
Verdict: sound; keeps the selected build broad while making dependencies and
redistribution inputs explicit. Confidence: high.

### Tool tests join the root verification command

When: slice 01. New dependency-preparation tests would otherwise run only when an
agent remembers their individual command. The root test command now runs existing
workspace tests followed by the bounded tool-test suite; it adds coverage and
does not replace any existing tests. The plan required the full final check but
did not name an owner for these new pure Node tests. Future build-helper and
consumer-tool checks use this suite. Verdict: sound; one discoverable final gate.
Confidence: high.
