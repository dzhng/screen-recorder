# 21e — Caller-authored projects from captured sources

Status: isolated caller-authored media journey verified; physical acceptance remains open. Dependencies: [21d](21d-captured-source-adoption.md), [04](04-projects.md), [09](09-first-preview.md) and [22](22-portable-projects.md).
Physical acceptance remains under [20](20-camera-reproduction.md) and parent [21](21-webcam.md).

The [verification packet](../assets/21e-capture-project-adoption/README.md) retains
source/runtime pins, public replay and media evidence, donor-free relocation,
diagnostic failures and the complete unprimed visual review. Next integration
seam: [21f public selection](21f-public-camera-selection.md).

## Contract

The caller can place settled captured assets in a durable project through
existing project/edit operations, with explicit canvas, tracks, placements and
links. Source timing stays truthful and occurrences remain independently editable.
Each existing mutation owner preserves its own replay identity; retry neither
repeats capture nor duplicates the requested project or edits.

## Seam and ownership

Use existing `ProjectStore`, acquisition admission, composition edits and
resource references. Capture publishes source identities, support and common-clock
mappings; it does not manufacture a project. The caller supplies its composition
through the existing typed commands. Store-generated IDs and transaction replay
remain implementation responsibilities. Preserve documented single-AV defaults
without extending them into a multi-video capture layout. An explicit fixture
composition is test input, not a global presentation policy. No capture-start
authoring settings, automatic presenter styling or processing are permitted.

Use clock-derived placement without independent zeroing or invented leading/tail
support. Capture finalization and project/edit transactions retain separate existing
replay outcomes. Preserve admitted sources if caller project construction fails;
retry the failed explicit operation through its existing owner. Do not add a
cross-owner finalization transaction, catalog or authoring API.

## Work and review surface

Create the planned `webcam.mjs --case capture-to-project` fixture through actual
isolated service/project paths. The fixture explicitly names canvas, tracks,
placements and links. Verify repeated source finalization and explicit project/edit
replay separately, lost acknowledgement, crash between admission and requested
project construction, restart and conflicting replay. Verify
independent selected camera/screen/audio replacement and undo, original hashes,
exact selected pictures/PCM and portable relocation. No personal editorial
judgment or new recording is needed.

## Acceptance

Keep the relevant [preservation gates](../verification.md#preservation-matrix) and
[single-owner rules](../architecture.md) green. Record the bounded fixture result,
source/runtime identities, failures and limitations under this child’s assets and
in the parent handoff. Prepared wiring, actual media parity and physical acceptance
are distinct verdicts. The one-frame synchronization and ten-second completed-stop
gates remain unchanged. No new capture, audible playback or installed switch.

## Visual acceptance

Judge synchronization and represented support at named retained/fixture landmarks;
styling is outside this gate. Compare full output frames and temporal crops against
the named fixture using [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md).
Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md)
as the last visual check before acceptance. Preserve shots and verdicts. Missing
physical or listening evidence remains unverified; silence cannot supply it.

## Failure boundary and discretion

Delegated: internal names, compact typed result structure and fixture organization
within the existing owners. No editorial policy, second lifecycle/catalog, silent
fallback, weakened preservation gate or fabricated physical verdict. A failure
reslices its actual owner rather than broadening into unrelated work.

User feedback changing the named contract requires updating this child and its
dependents before expansion. Existing accepted auditions and the selected 200 ms
room-tone recipe retain their exact-media scope and are not repeated here.
