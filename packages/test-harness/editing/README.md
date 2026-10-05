# Editing verification

This directory checks source and editing primitives through authored fixtures,
compiled requests and public service journeys. Start with the contract that could
have changed. Filenames name the subject; a runner's imports identify its shared
setup and observers. Case selection and invocation belong to that source, not a
second scenario catalog here.

## Source facts and project meaning

Source evidence distinguishes media occupancy, acquisition availability and
stream identity. A decoder holding a previous picture across a timestamp gap does
not prove that acquisition was available. Source selection checks therefore need
both byte identity and the evidence interval that authorizes those bytes.

Project checks ask how explicit edits map those sources into a revision. The
[composition owner](../../composition/README.md) defines that meaning; the harness
must not invent a second edit model. Compiled-plan probes isolate lowering, while
public journeys also test admission, delivery and persistent ownership. Passing
one boundary does not prove the others.

Preservation and cutover journeys carry existing guarantees across an owner or
contract change. Match the original operands and observable outcome instead of
recreating the old implementation. The [preservation registry](../../../specs/done/agent-editing/assets/23-owner-fixture-ports/README.md)
locates those scoped results and their producing code.

## Pictures, audio and processing

Picture checks separate source-frame membership, sampled project time, geometry
and encoded appearance. Layer, pointer, caption and scalar-motion fixtures belong
here because a structurally valid plan can still draw the wrong result. A decoded
image comparison needs matched input, output time and color interpretation;
encoding loss must not be mistaken for a composition or color-management error.

[Loudness references](loudness/README.md) separate independent BS.1770 arithmetic
from the exact signal/coverage reported by public operations. Meter agreement is
scoped to its signal families; abrupt resampler boundaries remain separate evidence.

Audio checks separate source addresses, placement and gain from conversion and
encoding. Authored nonzero samples and distinguishable channels expose errors
that silence or a symmetric fixture would hide. Exact retained PCM and lossy
encoded output require different expectations. A/V checks compare both clocks
against the same authored landmarks rather than merely comparing total duration.

Prepared processing adds state and ownership. An output window can be short while
a learned processor requires context from a larger connected domain. The
[learned routing fixture](denoise-topology.mjs) anchors this distinction: the
reference state domain must match the requested graph, not just the delivered tap.
[Time/pitch references](stretch/README.md) explain their independent recipe role.

[Speech timing](speech/README.md) needs independent audible labels;
[generated-voice experiments](voice/README.md) distinguish runtime observations
from lexical, identity and splice-quality evidence. Their measurement boundaries
remain separate from caller edit intent.

[Optional runtime assembly](../../../helpers/model-runtime/README.md) preserves
explicit dependency precedence for local inference experiments. It produces an
artifact for the existing preparation owner, never another installer.

## Delivery, lifetime and work

Public journeys exercise the complete request, readiness, delivery and publication
contract. The [shared service fixture](source-evidence-fixture.mjs) owns real
CLI/MCP transport and process lifetime. Follow its consumers before writing
another startup, result receiver or shutdown loop. The [preview/export journey](first-preview.mjs)
uses that owner while retaining publication-specific fault barriers.

A held operation or crash is useful only when its timing isolates the failure
being claimed. Cancellation, stale replies, lease revocation and publication
before/after a commit protect different outcomes. Scale and budget probes vary
work that can grow independently, such as timeline duration, fragmentation and
metadata cardinality; a small output alone does not establish bounded work.

## Fixture and reference authority

The [corpus generator](fixtures.mjs) owns deterministic media construction.
Its [authored oracle](expected.json) is independent so the generator cannot certify
its own timing mistake. Frozen media keeps source hashes and encoder identity;
a toolchain change can alter bytes without altering decoded meaning.

Portable lossy picture fixtures have an explicit codec tolerance. Separate PCM
inputs let audio membership be checked without codec delay. Declared acquisition
holes and native empty edits remain separate inputs: a black frame or silence
cannot establish which condition caused it.

[Acceptance inputs](acceptance-inputs.mjs) bind retained marks to the original
source identity and clock. Reuse original narration rather than making another
copy or requesting another capture. A missing independent label leaves that
perceptual claim unverified; it does not stop unrelated primitive verification.

## Platform reproductions

[Native rendering](RENDER-REPRODUCTION.md) explains temporal sample support;
[color and encoding](COLOR-REPRODUCTION.md) explains appearance interpretation.
These isolate platform behavior with matched operands. They are reference
experiments, not competing product executors or evidence of general release
acceptance. Frozen measurements and detailed outcomes live with their evidence.

The [HDR transform reproduction](hdr-conversion.mjs) uses independently authored
PQ/HLG charts and a supplied pinned runtime to isolate conversion from encoding.
Its [clock probe](hdr-clock.py) separately checks sparse final support, exact common
origin and rotation. Neither selects an implicit source interpretation or supplies
a production publication path.

[Audio recipe reproduction](audio-recipes/README.md) retains numerical
normalization, limiter and compressor evidence before production admission.
