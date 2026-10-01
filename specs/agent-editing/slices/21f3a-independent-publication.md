# 21f3a — Independent closed-source publication authority

Status: native implementation and focused gates passed; root production review found no defect. Integration verification remains with the parent pass.
Native prerequisite of [21f3](21f3-public-camera-selection.md). Public camera
selection remains rejected until the complete allocation-to-project gate passes.

## Contract and owner

The existing native termination owner closes physical inputs once and retains
independent primary/camera publication outcomes. A published source remains usable
when its sibling has an operational publication failure. Retry preserves successful
publication and never closes or drains the input again. Preserve the existing
primary audio/cursor and camera publishers; expose their facts rather than adding
a second lifecycle, queue or failure policy.

Use bounded observations of pending publication (with its actual error), published
source support/evidence, or terminal unavailability. Allocation supplies source and
device identity; publication cannot invent or replace it. Physical closure is a
separate authoritative fact from completion of all publication work. Later21f3
uses it to preserve capture priority while inputs are live/draining, and to allow
shared heavy source admission after physical closure even when sibling publication
remains retryable. A queued receipt alone is not independent ready-asset acceptance.

## Immutable source evidence

Primary source publication establishes its own completion/proof before announcing
success. Its source journal must be an immutable validated prefix snapshot owned
by the existing publisher and journal lease/descriptor boundary. Later take
lifecycle suffixes must not change the file acquisition freezes. Preserve original
journals and their sequence/provenance; do not relax21f2a whole-file identity checks,
pretend growth is unchanged, or rewrite historical journals. Camera retains its
existing stable publication authority. Define one source-evidence representation
that native publication, recovery and later admission can consume.

Outcomes survive the other publisher's refusal and publication retries; recovery
verifies each source independently from owned paths and actual durable authority.
Callbacks/reads are fenced to the same native take/generation. The existing stop
acknowledgment remains immutable. Controller reports and core eligibility land in
21f3's atomic integration after this native prerequisite, through the existing
journal-numbered private lifecycle mechanism.

## Verification

Use the existing prerecorded device boundary and tiny retained numeric media in
an offline capture-test build. Cover primary-published/camera-pending and its
inverse, retry without a second physical drain, source unavailability, cancellation,
restart recovery and unchanged source binding/support. Add actual lifecycle
journal suffixes after primary publication and prove frozen source evidence stays
identical while the original journal preserves those later records. A control
using the live whole journal as that snapshot must fail. Pin complete inputs,
requests, receipts and output authorities; keep affected existing native gates.

Early donor admission adds a cancellation lifetime requirement. Coordinate the
unfinished borrower fence/drain with [23f](23f-capture-source-lifetime.md); ready
acquisitions remain independent. Do not invent a camera-only cleanup owner.

No new hardware capture, model work, audible output, application window, installed
switch or frozen-worker replacement. This establishes controlled publisher facts,
not physical synchronization, representative camera quality or stop deadlines.
Review shape, code, docs and choices; record the exact focused gate before commit.


## Implemented authority and handoff

[NativeCapture](../../../helpers/mac/Sources/ScreenRecorderCapture/NativeCapture.swift)
retains a bounded observation for its own generation. Physical closure is reported
only after both input drain and encoder closure. Each source then reports its own
publication result; a camera failure does not become the primary source's
completion diagnostic. The ordinary stop result still waits for both publishers.
A canceled retry retains an already-settled observation as a historical fact, not
as a promise that a donor survives discard or deletion.

[Source publication](../../../helpers/mac/Sources/ScreenRecorderCapture/CaptureSourcePublication.swift)
owns one durable receipt per source. It pins source identity, support, binding,
diagnostic, the immutable journal descriptor, and canonical/proof member hashes.
The primary's own completion is recorded once before its validated prefix is
copied. Camera uses its existing stable journal. File operations stay under the
existing journal and directory lease; receipts cannot replace occupied names.
Retry rechecks each existing media publisher and source receipt. Independent
recovery checks the same receipt and the existing media proofs, without creating
new publication metadata or guessing from directory contents.

The [focused prerecorded gate](../../../helpers/mac/Tests/ScreenRecorderCaptureTests/IndependentPublicationTests.swift)
uses actual filesystem refusals and altered authority bytes. Its retained-file
recovery deliberately releases native ownership while fixture files remain;
it does not establish catalog eligibility after cancel or delete. That remains
owned by the source lifetime fence in 23f. The existing input-generation and camera
publication gates remain required. No public selector, controller report, core
eligibility, or acquisition schema lands in this prerequisite.

## Remaining camera-origin prerequisite

The opt-in `SCREENREC_CAMERA_WITHOUT_PRIMARY_OUTPUT` probe is **red**. Suppressing
primary video callback delivery leaves the primary clock without an origin.
[Camera ingress](../../../helpers/mac/Sources/ScreenRecorderCapture/CaptureClockIngress.swift)
passes that clock to the camera writer, so offered camera frames are rejected as
outside support before publication can retain any camera media. The probe writes
its request, binding, result, observation, closure facts, and raw ingress evidence
before requiring a usable camera outcome. It must turn green through the separate
[camera clock/support prerequisite](21f3b-independent-camera-clock.md); publication must not invent an origin, align
sources to wall time, or weaken this requirement. The passing primary-audio
refusal case does not cover primary-video absence.


## Verification receipt

The offline `ScreenRecorderCaptureTests` build and focused independent-publication,
camera-publication, and selected-camera-input gates passed. The independent gate
also runs the existing prerecorded startup, stale-generation, and discard checks.
The separately retained camera-without-primary probe exits 133 with
`CAMERA_ORIGIN_REQUIRED`; it is not a passing 3a claim or a hardware result.

[The retained evidence packet](../assets/21f3a-independent-publication/README.md) pins the native
source freeze, compiled runner, requests, numeric inputs, journals, receipts,
closure facts, and each gate's output and exit disposition. Its SHA-256 is
`9c654c9090eaefba771981962d9640fbdc7d8513d0b487f972e86a637985adf5`.

The configured CLI review was attempted despite its prior known HTTP 400
availability failure. It again exited 1 before reviewing any code; there is no CLI
review verdict. No further retry or configuration change was made. Root's
production review inspected the implementation without a finding;
[merged native verification](../assets/21f3a-independent-publication/merged-verification.json)
passes the actual prerequisite on a separately pinned current-source runner. All local native runners and
the failed reviewer have exited. No hardware capture, audible playback, model
work, application window, installed switch, or frozen-worker replacement ran.
