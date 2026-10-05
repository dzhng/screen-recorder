# Current verification scope

On October 5, 2026 the user requested completion with live-device checks explicitly
unverified, and then said: “Don't overengineer the verification.” Remaining
acceptance is an app build and a quick visual review of the capture panel/Library.
Reuse useful existing checks; add no expanded verification harness or fixtures.
This instruction supersedes the original plan below where they conflict. Existing
recording ownership, explicit device selection and audio scope remain requirements.

The retained early evidence is scoped historical proof, not a requirement to
repeat it. No live-device success is claimed.

## Original planning gates (superseded where conflicting)

## Tests prove behavior; rendered and decoded output prove different claims

Before changing behavior, invoke [write-tests](../../.agents/skills/write-tests/SKILL.md).
Observe the intended red failure at the narrow seam, implement, then observe green.
Do not test spacing constants, private view trees or copied implementation formulas.
Fixtures should exercise the production views and owners with controlled facts.

Use the existing [native view renderer](../../apps/macos/tests/settings-view-shots.mjs)
and [controls compiler](../../apps/macos/tests/fixtures/swift-controls.mjs) as harness
patterns. New renderer/fixture names in slice files are proposed deliverables,
not commands that already exist. Their owning source must document invocation.

UI checks use scratch preferences/homes, injected state and offscreen window
images. Never activate the app, move the pointer or play sound in automated
presentation checks. A deliberately opened human preview may activate. Physical
media runs answer only a named question the cheaper fixtures cannot; run them in
the background with progress, deadline and cleanup. Reuse valid media evidence.
No editing project is needed to prove capture or this menu redesign.

## Standing visual gate

Every visual slice inherits this sequence; its slice file supplies variable and crop:

1. Capture actual native size, fixture state, appearance, backing scale and source
   revision. Keep the complete capture before making derived crops or alignments.
2. Invoke [compare-screenshots](../../.agents/skills/compare-screenshots/SKILL.md):
   candidate versus the frozen concept for that variable, and actual native
   before/after where applicable. Fill the reference landmark's candidate, delta
   and pass/fix/uncertain columns. Inspect cores, soft fringes and overlapping
   foregrounds independently. Telemetry supports a verdict; it cannot replace it.
3. Resolve material discrepancies or document a demonstrated platform constraint.
   Do not change the reference, shrink the app or crop a defect away.
4. Run [screenshot-critique](../../.agents/skills/screenshot-critique/SKILL.md) with
   an unprimed second agent as the **last visual acceptance check**. Give it shots
   and the review question, not the implementer's intended verdict. Fix findings
   and repeat the affected comparison before accepting.
5. Show accepted candidate/reference shots using
   [preview-shots](../../.agents/skills/preview-shots/SKILL.md). This checkpoint is
   non-blocking: allow about five minutes for corrections while independent work
   continues; if silent, decide from evidence, record rationale, close the shots
   and proceed. Silence is not approval of a new scope or irreversible action.

No geometry slice accepts palette; no palette slice silently revises geometry.
Whole-frame composition belongs to the final integration slice. Prototype board
labels, fake device names, sample thumbnails and interview reply chips are outside
product comparison. Native fonts, popover arrow/shadow and window chrome have
platform rasterization differences, which must be documented rather than silently
excusing differences in density or hierarchy.

## Frozen input and production parity

The [manifest](assets/reference-manifest.json) pins visual inputs. The inspected
production commit is provenance, not test evidence. Existing camera tests and
source inspection inform expectations; they were not rerun while writing the spec.

| Preservation claim | Owning slice | Evidence / parity gate |
| --- | --- | --- |
| Approved capture density and hierarchy | 01, 12, 13 | Native actual-size views against sharp concept crops |
| Separate persistent Library | 03, 05, 07 | Real window lifetime and existing controller/action fixtures |
| One state/action path, fixed take inputs | 04, 06 | Same owner exercised through UI/shortcut/Settings actions |
| Existing recording/publication formats and sources | 02, 08 | Old primary/companion fixtures unchanged; new camera primary verifies/reopens |
| Companion camera independent origin and host correspondence | 02, 08, 13 | IndependentCameraClockTests and independent publication fixtures |
| Explicit device identity and permissions | 04, 08, 09 | Missing/denied/disconnected input scenarios; no-screen path |
| Narration remains separate original PCM | 09 | Authored timestamps/samples; decoded output and scoped physical parity |
| Whole-system audio without screen video output | 10, 11 | Frozen platform reproduction versus production inventory and decoded media |
| Library generations/deletion/export semantics | 07 | Delayed replies, cursor changes, occupied/retry/cleanup fixtures |
| Focus, keyboard reachability and capture exclusion | 05, 13 | Actual AppKit behavior; controlled decoded capture evidence |

After the system-audio reproduction passes, freeze its code/dependency/configuration
hashes, request, selected identities, authorization facts, raw report and media
before production wiring. Slice 11 compares the production entry point against
those matched inputs and complete output inventory before further expensive runs.
Permitted differences are managed allocation IDs/directories and presentation;
selection, source scope, synchronization, omission and teardown must agree.

## Completion gate

During slices, use the narrowest relevant existing runner and affected cases.
Read its owner for current flags; do not invoke the macOS package's entire test
script for each view or source change. At the finished implementation, run the
full required root build/type/test/lint/format checks once as owned by
[the manifest](../../package.json), including native requirements. A skipped
physical gate remains explicitly unverified; it does not become a pass.

Run [review](../../.agents/skills/review/SKILL.md) and the required independent
[Codex review](../../.agents/skills/codex/SKILL.md), resolve substantive findings,
and update owner READMEs with principles. Do not commit unrelated dirty files.
Use [close-spec](../../.agents/skills/close-spec/SKILL.md) only when all required
feature work has actually shipped; planning completion does not archive a build
that has not started.
