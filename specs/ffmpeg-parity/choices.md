# Implementation choices

The user authorized implementation on 2026-10-04 via /goal /implement-spec.
This ledger records decisions outside the frozen plan; delegated internal naming
and fixture selection are discretion, not new product decisions.

## Sound choices

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
