# Inspection plan synthesis

Three independent read-only drafts inspected the implemented code: two Codex
agents optimized for the fewest slices and clean ownership seams; Claude Opus
optimized for early risk discovery. This is planning evidence, not runtime proof.
The [risk-first draft](risk-first-claude.md) is retained verbatim, including the
incorrect observations and rejected recommendations identified below. The other
two drafts' shared findings are condensed here.

## Agreement and chosen cuts

All three found recording-specific source/transcript identities and acquisition
roles beneath the otherwise ready asset/project queue. Asset origins are only
provenance strings; physical probe occupancy cannot choose capture acquisition
facts. Exact range projection is ready, but public occurrence iteration, source
acquisition and direct frame/acoustic delivery are not yet implemented.

The fewest-slices draft proposed source acquisition, occurrence reads, direct
frames/index and PCM/acoustic inspection. The seam-focused draft separated pinned
occurrence paging from phrase matching and PCM delivery from acoustic summaries.
The synthesis keeps one occurrence-query owner (including track-local phrase
state), while making PCM delivery a separately verifiable prerequisite. Acquisition
is one vertical acceptance target, with reviewed native/context/core passes allowed
inside it. Its first useful result is real selected-stream source transcript reads,
not merely a schema or fake native fixture.

The next contracts are [10b](../../slices/10b-source-acquisition.md),
[10c](../../slices/10c-occurrence-queries.md),
[10d](../../slices/10d-frame-inspection.md) and
[11a](../../slices/11a-audio-delivery.md); the original 10/11 requirements remain
umbrella acceptance. Acquisition can feed PCM delivery in parallel with occurrence
queries once their shared native/context boundary is ready.

## Decisions and rejected alternatives

- **Acquisition is an explicit occurrence binding.** Identical media bytes may have
  different capture support. Omitting a context means physical support; it never
  chooses the first/latest origin or combines all capture histories. A context mask
  constrains existing model availability, so playback, source transcripts and
  projected evidence agree. Putting it only on inspection was rejected because it
  could omit words while still rendering their audio. Media replacement selects a
  new source binding; split/copy preserve the selected one.
- **ASR identity includes segmentation/context.** The risk draft proposed dropping
  context from transcript identity if a limited comparison produced the same words.
  That is unsound: identical results in one fixture do not make segmentation cease
  to be an inference input. Retain the context/support/model/policy identity without
  changing the existing ASR recipe.
- **No second native PCM executor.** The risk draft overlooked the implemented
  composition audio operation and finite PCM stream. Audio inspection must consume
  those existing owners. Direct compiled-picture still delivery is a real missing
  seam; it shares the compositor rather than round-tripping through a movie.
- **Core owns occurrence reads.** The risk draft's bounded-merge kill test is useful,
  but seekable source readers and dependency manifests belong in core. Composition
  remains the pure mapping/index/ordering owner. A source-ordered cursor with an
  added clip ID cannot represent project order.
- **Context adoption is explicit and bounded.** The new acquisition importer accepts
  a named captured-source directory and retains validated raw provenance/media
  bindings. It does not scan a user's library, follow mutable donor references or
  migrate edit history. Capture finalization later uses that same admission owner.
- **Pin manifests instead of inflating cursors.** A continuation names its immutable
  query/dependency manifest and exact position. Changed source generations reject
  continuation; a newer project head does not alter an explicitly pinned revision.
  Do not add a separate read-session service or eager projected-word table.

The same-bytes gate is concrete: physical support is continuous; context A has an
internal acquisition hole, B does not. A word spanning that hole is partial only in
A. Native PCM must exclude A's missing interval without changing B or the physical-
only occurrence. Existing acquisition-gap fixtures supply the semantics; this new
combined project/native case has not yet been implemented or verified.

## Preservation and limits

Keep existing source/transcript/raw audio/native speech and recording/package
inspection semantics until cutover. Retain 10a exactness and the real preview/export
journey. New context, multi-stream, generation, paging, phrase and tap cases must
run through real public routes as they land. Frozen rows can prove exact projection;
actual native inference is a separate required path. Neither fixes the open
word-timing or listening-quality gates in 12/12b.
