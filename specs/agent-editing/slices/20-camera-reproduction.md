# 20 — Prove screen and camera timing

Status: [offline clock/separate-source prerequisite](20a-offline-clock.md) verified through its exact PCM/recovery/publication children; [selected-device probe preparation](20e-selected-device-probe.md) is verified offline; a real user-shortened take is retained under [fixtures](../../../fixtures/screen-camera-timing/README.md), with ordinary import verified. Graceful probe stop is offline-verified; [20e2](20e2-camera-presentation.md) corrects camera admission/presentation and verifies saved-take recovery. [Physical-event evidence](../assets/20-physical-sync/README.md) matches flashes/beeps, but camera visibility and measurement uncertainty do not establish the one-frame bound. The [bounded camera hashing pass](../assets/20e-camera-picture-hashing/README.md) preserves complete decoded-picture verification while reducing offline fresh publication to a23.970-second mean; it still exceeds ten seconds. Physical timing and interruption acceptance remain open. Dependencies: [00](./00-corpus.md).

The [20f scheduling correction](20f-camera-publication-overlap.md) now overlaps
the complete raw/canonical scans for qualified closed inputs. Compact preservation
and actual reader cancellation pass. A [single qualified H264 interruption](../assets/20f-camera-publication-overlap/h264-interruption/README.md) now verifies
actual prefix fallback. [Retained-take metadata eligibility](../assets/20f-camera-publication-overlap/retained-eligibility/README.md)
passes; actual full-take overlap/adoption/measurement, peak decoder memory and stop
latency remain open.

[20g raw-prefix feasibility](20g-camera-raw-prefix.md) has mixed physical evidence:
one ordinary prefix remains identical, but the separate candidate fails before
intentional interruption. Missing later operands prevent diagnosing that mismatch;
no general prefix rule, recovery mechanism or stop improvement is qualified.

## Contract

Establish a measured shared-clock strategy for synchronized production acceptance
of simultaneous screen, camera and microphone capture. Isolated public integration
may proceed from the verified offline owners while physical proof remains open.

The [digest cost audit](../assets/20e-camera-digest-components/README.md) preserves
full-picture parity in two isolated release publications. Their context-specific
latency still exceeds ten seconds; no new production fix or physical pass follows.
Its frozen packet's closing speech-pickup note is historical: saved human marks
now support the [scoped eight-edge comparison](../assets/12-human-frozen-comparison/README.md).
That note must not trigger another marking request; broader speech quality remains
under [12](12-speech-evidence.md).
A [digest-stage prefix diagnostic](../assets/20e-camera-digest-prefix/README.md)
was compiled but never executed. Its [read-only disposition](../assets/20e-camera-digest-prefix/execution-disposition.json)
preserves zero attempts: the existing component measurements address its material
optimization hypotheses, and finer historical attribution would not select a
supported fix. Compilation and source equality supply no new timing verdict.

The [retained marker diagnostic](../assets/20-retained-marker-resolution/README.md)
extends candidate visibility with finer samples and preserves a separate clock
coordinate comparison. Partial predecessor flashes and clipped numbers prevent
a physical onset bound; no synchronization acceptance is added.

## Seam and ownership

Feature-owned native capture reproduction using ScreenCaptureKit and AVCaptureSession candidates. Emit separate source tracks plus timing observations; no presenter layout is baked into captured pixels.

## Work and review surface

Reproduce documented device capture with an explicit selected camera. Measure start offsets, pause/resume and drift with a shared visible/audible event. Retain raw timestamps and gaps. Use supplied prerecorded media for plumbing while real device permission/input is unavailable, without claiming the physical gate passed.

Create this planned probe in this slice:

```sh
node packages/test-harness/editing/camera-reproduction.mjs --case shared-clock
```

## Staging

The retained [physical take](../../../fixtures/screen-camera-timing/README.md)
contains about 246 seconds of camera and 251 seconds of screen/microphone media.
It already meets the user's requested duration. The current physical detector's
strong camera-marker result covers roughly 70 seconds; that is the scope of the
analysis, not the length of the recording or proof that the rest is unusable.

Finer samples now support a wider candidate interval, and the journal/native
comparison shows that camera coordinate translation leaves the measured residuals
unchanged. Screen cursor metadata now ties native timestamps to acquired callbacks;
different decoder frame counts leave same-picture correspondence unsupported.
That link and physical onset uncertainty remain the concrete gaps. Preserve the
frozen analysis as baseline,
declare any changed detector/selection rule, inspect its false positives and
report supported intervals plus uncertainty. Do not fit away drift, recenter each
event, loosen the one-frame target or infer unseen markers from cadence. Stop
when the retained evidence cannot resolve the bound; report that precise gap.
Do not request a repeat recording merely because this coarse analysis is incomplete.
No new capture is authorized.

[20a](20a-offline-clock.md) proves only controlled timestamp conversion, the existing
pause mapping and independent writer/recovery plumbing using prerecorded inputs.
Its production PCM requirement is verified through [20b](20b-exact-capture-audio.md),
[20c](20c-sparse-capture-materialization.md) and [20d](20d-capture-publication.md).
Together with their publication/recovery children, these preserve exact placement,
canonical recovery and safe publication. None
validates actual device clocks or passes this slice's physical gate. After
that checkpoint, analyze the retained authorized take using its explicit selected
camera/microphone/screen identities and recorded capture identity. Keep one
declared initial alignment; do not fit away residual drift or flatten the sources.
The [audit](../assets/20a-offline-clock/planning-audit.md) names required user setup,
permissions and separate interruption scenarios. The user subsequently chose roughly 200 seconds
for this physical take; retain the shorter observed scope rather than requiring
another ten-minute handheld recording.

## Acceptance

The real screen/camera/audio take (at least200seconds, per the user’s revised duration) has measured relative drift within one output frame after declared initial-offset alignment. Do not extrapolate its measured drift to ten minutes. Exercise interrupted camera, missing microphone, pause/resume and non-zero capture offsets. Confirm clean separate source media and recoverable partial results.

Record physical timing, live device lifecycle and closure latency as separate
verdicts. The retained take supplies actual input and long-duration evidence; it
does not contain every interruption/pause scenario. Prerecorded lifecycle tests
remain plumbing proof. Responsive control acknowledgment does not prove completed
input drain, media closure/publication or AppKit shutdown. The ten-second stop
boundary and complete ordered picture verification remain unchanged. Existing
over-budget publications do not justify another hashing trial without a concrete
contract-preserving mechanism and a bounded question. These open claims do not
block isolated 21 integration or unrelated consumer preservation preparation.

Keep the relevant [preservation gates](../verification.md#preservation-matrix) green. The [contracts](../contracts.md) and [single-owner rules](../architecture.md) are binding. Record evidence and remaining limitations in this Status line and the [README handoff](../README.md) before ending the pass.

## Visual acceptance

Judge **cross-source synchronization**, using shared flash/event regions in screen and camera frames; presenter layout and image aesthetics are out of scope. Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) against the named fixture/reproduction or prior accepted shot. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual check before accepting this slice**. Preserve shots and verdicts under this slice's assets folder.

For human review use [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes while progressing independent work, then decide from evidence and close the shots if there is no response. Missing listening/capture evidence remains unverified; silence is not a pass.

## Failure boundary and discretion

If clocks cannot be reconciled directly, reproduce explicit measured source offsets/alignment and freeze that approach. Do not hide drift by baking a webcam overlay into the screen video or substitute imported footage for the capture gate.

Delegated: Native capture synchronization mechanism selected by measurements. Separate sources, truthful gaps and existing recording controls are fixed.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.
