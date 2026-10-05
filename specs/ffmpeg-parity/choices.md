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

### Keep uncertain preparation in its admission slot

When: slice 06. If importing a take times out, the helper cannot tell whether
nothing happened or a job is already running. It saves the intended call before
sending it, keeps that take in its concurrency slot and resumes with the same
import identity. For speech, it reads current status with preparation disabled
before deciding whether an explicitly requested retry is needed. A polling
budget ending does not free a running job's slot.

Gap: interrupted helper recovery and multi-stream admission were unspecified.
Reach: task manifests are durable caller-owned records, not another product queue;
failed siblings wait for pending work before retries admit more processing.
Verdict: sound; bounds outstanding work while preserving completed results.
Confidence: high.

### Retain literal caption meaning even when SRT cannot represent it safely

When: slice 12. A caption containing a timing-shaped line can become a second cue
in an SRT reader, and a literal tag can become formatting. SRT refuses these
ambiguous payloads with VTT guidance; ordinary comparisons and ampersands remain
literal Unicode. VTT escapes its own syntax and independently preserves the text.
The export freezes exact serialized content at admission, so later edits cannot
change an already requested delivery.

Gap: the plan required format-specific escaping but not ambiguous-text policy or
when serialization becomes immutable.
Reach: plain captions retain meaning; styling loss and newly rounded overlaps are
reported. Limits refuse whole requests rather than silently dropping cues.
Verdict: sound; follows independent reader evidence. Confidence: high.

### A CLI command finishes only after its process group is gone

When: slice 03. A command can exit while a descendant keeps running, even after
closing every pipe. The existing native worker runs an argv-only CLI mode and
reports command status on a private pipe while continuing its parent-death watch.
The service drains output and observes that the known process group no longer
exists before releasing staging or capacity. If the kernel delays retirement,
ownership remains held with bounded diagnostic polling rather than false success.

Gap: the plan did not prescribe topology, completion signaling or exceptional
retirement behavior. The private completion descriptor follows caller descriptors
and is closed when the real command starts, preserving inherited input numbering.
Reach: native JSON work and raw media commands share one lifetime owner, without
a second supervisor executable. Cancellation remains active through retirement.
Verdict: sound; prevents descendants surviving their owner. Confidence: high.

### Shrink transcript pages instead of keeping a hidden remainder

When: slice 07. If an exact transcript page will not fit the helper's output-byte
budget, the helper rereads the same opaque cursor with a smaller row limit. It
never consumes half the page and hides the remainder in private state. Literal
rows and their indexes survive; rounded phrase times only help navigation.
An oversized single row refuses instead of truncating evidence.

Gap: page splitting, byte accounting and continuation storage were unspecified.
Reach: continuation remains portable and pinned to revision/generation; every
attempt counts against a read budget. `prepare:false` makes absence a read-only
answer, while omitted preparation keeps existing client behavior.
Verdict: sound; preserves the transcript owner's pagination and clocks.
Confidence: high.

### Timeline pictures retain evidence rather than imply continuous coverage

When: slice 08. An agent asks for a few pictures, waveforms and words in one
window. The helper draws an SVG and retains exact JSON from the existing owners.
Picture cards connect to requested-time ticks and distinguish decoded times and
unavailable samples; sparse stills never claim continuous viewing. Faint word-row
guides are labeled as layout, so they cannot be confused with media support.

Gap: artifact format, sparse picture presentation and shared bounded-input owner
were unspecified. The common artifact reader also serves compact transcripts.
Reach: consumer conveniences reuse product clocks and delivered files rather than
opening internal caches or inventing a second projection. No speech preparation,
model download or edit follows from missing evidence.
Verdict: sound; truthful bounded review aid. Confidence: high.

### HEVC shares common controls but excludes H264-only settings

When: slice 25. A caller chooses HEVC explicitly. It receives native Main 8-bit
Rec.709 MP4 with the chosen preset's common bitrate, keyframe and AAC settings.
H264-only entropy and level fields refuse rather than being silently ignored.
H264 remains the default with its existing resolved settings. Native preflight
checks the requested combination and the receipt verifies the encoded header.

Gap: the plan left HEVC control shape, profile verification and unavailable
inventory behavior to reproduction.
Reach: the output schema distinguishes codecs; discovery reports HEVC readiness
separately, with no silent fallback or FFmpeg production dependency.
Verdict: sound; extends the existing output owner. Confidence: high.

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
