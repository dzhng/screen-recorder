# Public selected-source transcripts

The [live harness](../../../../packages/test-harness/editing/source-evidence.mjs)
uses real CLI child processes and MCP stdio against a scratch project service and
frozen native worker. Its two distinguishable streams contain parts of the retained
real narration, with a nonzero container origin and an internal physical empty edit.
The frozen native-selection outputs are the independent reference for complete raw
engine output and normalized public word ranges. Only engine processing time is
excluded from raw equality; word text, token timing and confidence stay exact.

Models are never downloaded. An absent-model request is exercised first, then
already prepared model files are copied into the isolated library, verified against
the production hash pins, and given a receipt recording the copied files' identities.
Native inference re-verifies the files. The original model files and narration remain
untouched. A captured cold-load stack shows CoreML's local model specialization;
it is not a speech timing or throughput acceptance result.

Acquisition journals A and B are explicitly synthetic provenance fixtures around
identical real speech bytes. They prove import, mask and lifetime semantics, not a
physical recording session. A excludes additional intervals; B retains physical
support. Deleting donor directories before requesting transcripts proves reads use
retained assets/evidence. A native-reply barrier holds a successful real inference
before publication, so cancellation and explicit retry exercise actual work.

The project extension places the same bytes three times, selecting A, B and no
context. Public authoring and delivered movie PCM are live; named word projection
and compiled availability are inspected through the existing pure engine. This is
not a public occurrence-query endpoint. The deliberately blank movie canvas keeps
this an audio test; it makes no new visual acceptance claim.

Original harness failures are retained: cancellation readiness uses the established
`not_requested` state with reason `canceled`, and the pure compiler requires a
revision identity. Neither changed product behavior or relaxed a quality threshold.

Run with a frozen native worker and the retained model request's files available:

```sh
SCREENREC_NATIVE=/absolute/path/to/frozen-native \
  node packages/test-harness/editing/source-evidence.mjs --fixture selected-streams
```

The broader editor, ASR timing, natural joins and listening acceptance remain open.

## Review and isolation proof

[Independent review](review.txt) found three harness weaknesses: a fully silenced
masked occurrence could satisfy its exclusion checks, empty search pages could loop
without a bound, and a final shutdown failure could leave exit status zero. The
harness now requires retained speech in every occurrence, bounds and deduplicates
search cursors, and fails the process on teardown errors. A real public edit that
sets the first occurrence's gain to zero fails the strengthened
[retained-speech assertion](failures/silent-masked-occurrence.json).

[Native preservation](audio-poison-preservation.json) was rerun against the same
frozen worker. Its poison fixtures exercise the production composition audio
executor with physically present impulses excluded by compiled acquisition context;
every delivered PCM sample must remain exactly zero. The native decoder receives
physical support and intersects each occurrence's context independently. The new
public project checks exact compiled masks/context before inspecting delivered AAC
PCM, including positive speech for A and identical-source B/physical occurrences.
Together these establish context propagation and neighbor isolation through the
shared executor. The poison input itself is a direct native harness, not a public
project import; the evidence does not disguise that distinction.

The final [live report](report.json) passes, and [runtime verification](runtime-verification.json)
compares every recorded production module with the integrated main worktree.
[Complete native requests, receipts and raw lines](native/) retain matched-input
inference evidence, including the canceled successful call. The [project report](project.json)
and [delivered movie](different-contexts.mp4) retain exact masks, projection and PCM
measurements. The original run verifies pinned preview bytes after restart while that revision is still head.
The [history correction](history/report.json) advances head before testing historical reads.
The independent review fixes, exact schedule count and existing native poison
checks are all verified; no ASR or media-quality threshold was relaxed.


## Historical revision correction

The earlier report is retained with its original scope: it did not advance the
project head before restarting. The corrected journey performs a public output-gain
edit, verifies that both the revision ID and document changed, and confirms the new
head survives restart. It then requests the old revision and requires its exact ID,
complete original document and original preview bytes. This distinguishes actual
history from restarting a project at its current revision.

[Focused review](history/review.txt) caught that unchanged clip acquisition IDs
alone could accept a new-head response from `revision.get`; comparing the complete
original public edit receipt closes that gap. The delivered historical preview is
verified independently. No media threshold or native implementation changed.
