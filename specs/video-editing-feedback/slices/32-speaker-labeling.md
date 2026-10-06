# 32 — Publish speaker-labeled transcript views

Status: planned. Depends on: [31](31-speaker-continuity-replication.md), [21](21-synced-angles.md), [03](03-published-work-contract.md), [07](07-speech-timing-admission.md).

## Contract

Public operations expose stable anonymous turns and speaker-labeled source/project
transcript views. Caller-authored names can bind to proven speaker/source identities.
Mixed recordings work within the frozen 31 envelope; raw per-person sources supply
explicit attribution when the brief/source evidence establishes who is speaking.

## Seam and ownership

Existing speaker evidence owns acoustic turns and continuity. Extend its public
prepare/read contract rather than adding a competing diarization API. Core owns
explicit label bindings to that evidence or declared raw-source/session identity;
transcript views join those pins on read. Do not overwrite source words or duplicate
speaker facts into a separately cached labeled transcript. Composition remains the
owner of occurrence/retime mapping.

Current starting points:

- [Protocol operations](../../../packages/protocol/src/operations.ts)
- [Speaker reads](../../../packages/core/src/speaker-read.ts)
- [Project speaker projection](../../../packages/core/src/project-speakers.ts)
- [Transcript reads](../../../packages/core/src/transcript-read.ts)
- [Project transcript projection](../../../packages/core/src/project-transcript.ts)
- [Speaker transfer tests](../../../packages/core/src/speaker-portable.test.ts)
- [Consumer transcript helper](../../../skills/yap/scripts/compact-transcripts.mjs)

## Scope and frozen decisions

Replace the exactly-30-second public execution restriction with explicit selected
range preparation under the proven bounded recipe. Preparation identity includes
source/acquisition/channel/range/model/decoder and continuity recipe; pages bind
that generation. A stable ID means one voice within the admitted source-session
observation, never the same person across independent sessions/generations by fiat.

Expose turns with exact ranges, stable ID, provenance and overlap/unknown status.
Provide an explicit public binding operation mapping selected IDs or declared raw
source participants to caller-supplied display labels. The editing agent can submit
names supported by the brief or source evidence; no human confirmation is required.
Otherwise use anonymous labels such as Speaker A. Renaming changes the binding,
not acoustic inference or source transcription.

Transcript views carry binding/evidence generations, occurrence and original word
identity. A word wholly covered by one supported turn can have one speaker. Crossing
turns, overlapping speakers or uncertain observation produces candidate IDs or
unknown; never use nearest-speaker/majority-time guessing as an undisclosed default.
Keep raw-source owner identity distinct from audible-speaker identity when a person's
camera includes another person's voice or mic bleed. Authored silence/gaps remain
separate from unobserved activity.

Project reads preserve repeated/retimed occurrences and overlap. Explicit binding
edits retain revisions/history/package dependencies under the new format. Old
30-second consumers/formats cut over together with no dual reader or migration.
No automatic voiceprint enrollment, cross-session naming or person recognition.

## Runnable checkpoint

The public CLI prepares a mixed multiwindow selection, reads labeled turns and a
compact labeled transcript, binds supported names, then reads an edited revision
with a repeated/retimed passage. A per-person raw-angle case and an overlapping
conversation case show the distinct attribution paths and remaining unknowns.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) first. Extend real
CLI/service source/project/portable journeys, using complete frozen 31 outputs for
cheap seam checks and only the minimal new native confirmation needed for integration.
Check slot permutations, changed generation/binding cursors, rename without inference,
unknown/simultaneous speakers, absent runtime after retained publication, source gaps,
camera/mic bleed, word-crossing turns, retiming/repeats and new-format package replay.

Consume real public receipts through the compact helper. A transcript-looking table
that assigns the wrong voice must fail automatic controls even if all words match.
Naming accuracy and continuity cannot be proved by agreeing with the same diarizer's
output used as input. No listening/labeling task is delegated to the user.

JSON/text checkpoints require no visual acceptance. Any annotated screenshot must
declare a speaker-row mask, use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md),
then unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md)
as the last visual check, and [preview-shots](../../../.agents/skills/preview-shots/SKILL.md)
for viewing without an approval gate.

## Delegated choices

Public binding operation/field names and storage organization are delegated; strict
inputs and generation pins must preserve the semantics above. Display formatting
may vary. Any new cross-session identity policy requires reslicing.

## Must stay green

One speaker evidence/binding owner, honest unknown/overlap, exact word occurrence
projection, source integrity, explicit model preparation and source/project/package
replay. Run scoped review and update the spec prompt/traceability before ending.

## Direction that would change this slice

The brief may require roles, real names or anonymous labels. All are explicit caller
bindings over observed identities, never a reason to infer unsupported people.
