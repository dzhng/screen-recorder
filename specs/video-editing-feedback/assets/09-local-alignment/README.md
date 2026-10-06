# Bounded CTC alignment reference

The [verdict](verdict.json) accepts the original NeMo auxiliary CTC head for
**observed provider text correspondence with conditional estimated timing**.
The tested FluidAudio CoreML conversion fails independently planted placement
controls. Neither recipe establishes lexical ground truth, calibrated confidence
or partial-fragment recognition.

## Evidence contract

Supplied text and greedy CTC text are separate operands. A word is `matched` only
when the same ordered pair occurs in every optimal correspondence; missing text
is `unmatched`, tied repeated occurrences are `unknown`, and additional greedy
words remain observations. For example, an extra final `blue` cannot choose the
same observed occurrence twice. The
[frozen correspondence protocol](nemo-ctc110-correspondence/protocol.json)
owns this policy. It uses the core `foldWord` owner for literal normalization:
case and outer punctuation fold, without numeral expansion or fragment guesses.
The retained arithmetic is a research reference; production integration must
share the ordered correspondence owner with native speech-window reconciliation.

Forced paths remain conditional estimates even for matching words. Their native
frame clock is retained, including ceil-sized model support. The
[physical admission protocol](nemo-ctc110-admission/protocol.json) refuses token
cells that enter unowned PCM rather than shortening their endpoints. Full raw
paths remain inspectable. A partial provider string may correspond to supplied
text while its phonetic identity remains explicitly unknown.

## Replay

Run the read-only [replay](replay.mjs) with Node; it performs no inference,
networking, preparation, source edits or writes:

```sh
node specs/video-editing-feedback/assets/09-local-alignment/replay.mjs --help
node specs/video-editing-feedback/assets/09-local-alignment/replay.mjs --list
node specs/video-editing-feedback/assets/09-local-alignment/replay.mjs --case constructed-repeats
node specs/video-editing-feedback/assets/09-local-alignment/replay.mjs
```

The [bundle manifest](bundle.json) pins stored and decompressed bytes. Replay
checks complete native Float32 matrices, greedy collapse, path arithmetic and
optimality, conditional token spans, frozen provider correspondence and separate
source admission. Support classification uses exact rational frame/sample support;
native floating-point endpoint roundoff remains separately visible. [Verification](verification.json) records scoped results and
intentional red falsification; it does not repeat model inference.

## Provenance

The [accepted recipe interpretation](accepted-recipe.json) corrects Fluid-only
descriptive fields inherited by the historical NeMo comparison protocol without
changing its frozen bytes or actual invocation. Frozen recipes retain model, runtime, preprocessing,
tokenizer, request, clock, cost and license identities. Metadata is an inventory,
not local readiness for untested candidates. The reference uses the existing
`Models` preparation and service `jsonWorker` transport owners in isolated scratch,
with inference networking denied. The original NeMo stdout refusal and its
transport-only correction remain distinct receipts.

Model weights, runtime/build binaries and whole-source media are excluded.
Only the selected bounded numerical PCM/control operands are retained.
Original absolute paths in frozen receipts are historical identities; replay is
relocatable. Raw source media and user-managed state remain intact.

The [verdict](verdict.json) owns measured gate results and remaining limits.
This reference alone does not implement the public contract. Its integrated
preparation, retained reads and portable project-tap proof live with the
[slice10 evidence](../10-word-attribution/README.md).
