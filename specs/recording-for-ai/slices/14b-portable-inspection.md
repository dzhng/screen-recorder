# 14b — Shared read-only inspection after relocation

Status: internal directory inspection/native parity passes in
[14b3](14b3-retained-inspection.md), building on the [14b1 consumer seam](14b1-audio-read-seam.md)
and [14b2 source reader](14b2-source-evidence-pages.md).
[Generated evidence](../assets/portable-inspection/native-relocation.md) includes the
original catalog/media being unavailable. Public ZIP/package lifetime, export
admission and accepted transcript integration remain 14c–e. No public export menu
or playable movie is claimed by this checkpoint.

## One question and seam

Can a previously unselected frame/trail be reproduced after the original library
and analysis cache become unavailable, without a second inspection engine?

Introduce a read-only inspection context resolved by an owner, not by path guesses.
Its immutable header names source identity, pinned/default revision, included history
bound, evidence generations and policy/options; a bounded asset resolver maps
inventory references to local media. Library and fixture-directory adapters provide
that same context. A context is not a mutable recording, queue or RevisionStore.

Keep existing library admission/publication in FrameInspection, IndexProcessing and
AudioInspection. Move only the consumed read capabilities and reusable planning out
of their concrete stores, and migrate library consumers in the same pass:

| Capability | Existing owner to preserve |
| --- | --- |
| Revision validation, source/playback mapping, word/event projection | timeline.ts; revision/history reads from the library or manifest adapter |
| Normalized cursor, pauses, timed/unplaced geometry and audio acquisition reads | SourceEvidenceStore's bounded read surface, extracted as a narrow interface |
| Canonical scene pages and selected index entries/coverage | SceneEvidenceStore and ScreenshotIndexStore read contracts; no preparation on a package read |
| New clean/annotated frame and trail cutoff | materializeFrame and planFrameTrail, with injected read interface and explicit source/output |
| Requested-time visual sampling | Existing scene policy and native VisualSampler; disposable visual-cache optimization is optional |
| Audio excerpt spans, missing roles and gaps | Extract the reusable plan from AudioInspection, retaining timeline trimSpans and its native decoder |

The package adapter consumes ordinary serialized evidence, including sequence and
uncertainty metadata. It must page bounded records rather than load the complete
journal/index. Define the minimum file seek/page layout with its producer in this
pass; an optional rebuildable acceleration index is not a cloned library catalog.
No recording/job/edit rows, fake ready artifacts or synthetic idempotency state may
be created merely to satisfy existing constructors.

## Invariants to pin

1. Library inspection remains the first consumer of the extracted interfaces; do
   not leave an old implementation beside a new package-specific algorithm.
2. Included historical revisions use the same mapping routines. Retained screenshot
   index data describes the pinned exported revision only; requesting absent index
   evidence fails explicitly rather than silently reindexing or returning another edit.
3. Portable frame metadata references inventoried images, not original output paths
   or derived-cache IDs. New request outputs belong to the caller's disposable cache.
4. Bundled canonical scene boundaries do not replace the request-local comparisons
   performed by planFrameTrail. Preserve their evidence/policies and reproduce fresh
   bounded samples from relocated source when needed, including actual decoded times.
5. Unsupported frame/trail/scene policy versions or options fail explicitly; silently
   running today's policy would not reproduce the package's evidence.
6. Context identity is distinct from embedded recording identity. Two packages with
   the same recording ID cannot share mutable output/lifetime ownership accidentally.
   Native workers, caches, deliveries and pagination cursors must be scoped accordingly
   when 14c adds handles. Do not create a second scheduler here: current JobQueue
   requires library revisions, so later package execution needs an explicit shared
   execution-identity seam, not made-up library rows.
7. Relative assets are resolved only beneath the owned fixture root. Full untrusted
   ZIP extraction and descriptor-safe read/cleanup lifetime remain 14c acceptance;
   successful internal directory inspection does not certify archive containment.

## Two narrow implementation checkpoints

**Reader parity first:** export generated source/scene/index records through their
owners into a fixture directory; parse them through the new read interfaces. Compare
revision/history, normalized cursor/geometry/pause and index/coverage pages, including
continuations, wrong source/generation, missing members and truncated data. Move the
directory and make the original root unavailable before checking it again. No native
movie renderer or accepted speech artifact is needed.

**Native inspection second:** call the shared materializer using those relocated
readers. Request new clean and annotated frames around a cut, canonical scene change,
pause, geometry change and sparse actual-time sample. Compare requested/actual source
and playback times, kept interval, pointer/trail observations, uncertainty, cutoff
reasons and pixels with the library path at identical parameters. Exercise audio
excerpt planning and native bytes with generated acquisition gaps and missing roles.
Keep the original analysis cache unavailable throughout. Bound processes, pages and
resident data; close every read/output and reap each owned native process.

Use one planned internal harness report, with no complete-package or public-route
claim. Compare visual outputs using compare-screenshots, then independent
screenshot-critique last; follow [visual review](../verification.md#visual-gates).
Keep library frame/trail/audio/index and timeline tests green; mutation-test the
adapter so a missing pause/geometry boundary or wrong context cannot pass parity.

Module/interface names, bounded file page layout and optional acceleration internals
are delegated. The single-owner algorithms, pinned identities, unsupported-policy
behavior and absence of a shadow library are fixed. Transcript payload/search and
movie preview stay with 08/13; do not invent stand-ins for those production owners.
Review the actual interfaces at this checkpoint before expanding 14c–f.
