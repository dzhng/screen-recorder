# 11 — Caption grouping and layout proposals

Status: implemented; focused consumer/native-frame proof passed. Question: **Can readable cues be proposed without rewriting speech or applying edits?**

Dependencies: [07](07-compact-transcripts.md).

## Contract and owner

Consumer helper over pinned words and existing text.seed/ordinary text placements.

Caller-selected width/lines/dwell/reading-speed/pause/safe-area parameters return proposed placements and violations. Preserve source pins and editable display text; no forced uppercase or semantic rewrite. Unsupported constraints return violations, not hidden mutation.

## Focused proof and review

Cue proposals and one small rendered caption frame during implementation.

Test corrected text, partial/repeated/retimed words, punctuation, multilingual glyphs and unbreakable words. Judge safe area and legibility within caption crop against plain seed control. Applying placements remains a separate explicit edit.

Retain source/control and candidate shots. Use compare-screenshots to judge the named variable/crop; show useful shots with preview-shots. As the last visual acceptance check, run unprimed screenshot-critique. Human response is a non-blocking chance to redirect reversible choices: allow about five minutes while doing other work, then decide from evidence, record the verdict and close opened shots. Never claim unseen or unheard quality.

## Boundaries and decision budget

Inherit the [global contract](../README.md#contracts-and-ownership) and narrow verification policy. Write-tests red/green precedes behavior changes. Existing native output and persisted identity remain unchanged unless this slice names the extension.

Delegate internal naming/decomposition, bounded fixture selection and reversible artifact styling. Public meaning and backend policy are fixed above; resolve a new semantic choice in this spec before coding it. Record actual commands, immutable input/runtime identities, coverage, failures and verdict. User feedback changes requested meaning, supported scope or visible appearance; mechanical preferences alone do not justify expanding the slice. A failed proof remains unfinished and must be narrowed or resliced, not waived.

## Implemented contract and focused evidence

The [pure consumer helper](../../../skills/screenrec/scripts/caption-proposals.mjs)
accepts one complete pinned compact project entry, explicit selected row indexes,
requested display corrections and caller constraints. Its `--help` owns the input
summary. Returned clip/geometry drafts reuse ordinary authoring contracts;
applying them remains a separate explicit pinned edit. No service operation,
catalog, queue, dependency or automatic treatment was introduced.

Instantaneous words retain their exact point evidence and raw positive seed pin,
with no placeable clip (`clip: null`), explicit instant/undefined-speed/minimum-dwell
diagnostics, and their own proposal. Neighboring words continue normally; positive
project duration is never invented. Meaningful caller separators survive wrapping;
only whitespace-only inter-word separators are replaced by a line break.

Original word labels, generation, occurrence IDs, full source word pins and exact
projected fragments remain intact. Display corrections never change that seed.
Grouping splits at explicit selection gaps, different occurrences/segments,
partial/discontinuous words, chosen pauses/punctuation and chosen size/dwell
limits. Grapheme width is a proposal constraint, not a pixel measurement. Every
cue carries `RENDERED_LAYOUT_UNVERIFIED`; oversized text, safe-area failures,
reading-speed/dwell failures and unsupported constraints remain visible. Nothing
is silently shortened, resized, extended or omitted. The ordinary admission
schema remains authoritative when a caller applies a draft.

Dwell and reading speed use the first-to-last projected word-support envelope.
They do not promise continuous supported reading time through gaps. Rational
comparisons decide pause, dwell and reading-speed limits; displayed CPS is only a
floating-point diagnostic. Source-only and incomplete entries return no drafts.
The whole UTF-8 response is bounded; excessive selections/cue counts refuse.
Existing per-cue seed limits split with a reported violation and preserve every
selected word. Incremental wrapping bounds the normal grouping work rather than
recomputing each growing prefix.

Focused checks:

```sh
node --test scripts/caption-proposals.test.mjs scripts/compact-transcripts.test.mjs
SCREENREC_NATIVE=/path/to/screenrec-native \
  node packages/test-harness/editing/caption-proposals.mjs /tmp/caption-proof-new
node skills/screenrec/scripts/caption-proposals.mjs --help
```

The two focused files passed 25 tests. Red/green caught fractional maximum dwell,
early-return UTF-8 budgets, per-cue seed limits, text-size diagnostics, empty
correction separator loss and exact reading-speed boundaries, meaningful separators during wrapping and valid instantaneous words. Deliberately
replacing grapheme segmentation with UTF-16 length and bypassing requested
corrections both failed for the expected reason, then passed after restoration.
A 1001-word selection proves bounded splitting without dropped pins. The command
works with a deliberately absent CLI executable and does no CLI work.

The [matched native frame evidence](../evidence/caption-proposals/report.json)
uses synthetic word labels, no ASR, and an audio asset descriptor only as the
ordinary content-anchor owner. It applies ordinary place/processing operations,
compiles the existing picture plan and runs native `media.renderCompositionFrame`.
This proves pure proposals plus native picture execution, not live retained
transcript-generation admission or public `frame.get`. Actual user drafts still
require explicit application and public frame/layout inspection.

Native SHA-256:
`af28fcc5260b79bca3909be2af1a9c90875bc3497d30d9649d3921648ef8c82d`.
Exact Arial font SHA-256:
`525979822591a3447cfc49d943d6f7683508e25543407871c0ed8fed05fd2bd9`.
No native rebuild, recording, transcription or user-media edit was run. Private
composition/protocol/core/service builds passed; unchanged native execution was
reused. The parent owns the final full-system run.

Control and candidate share text meaning, font, size, canvas, text box and geometry.
Only explicit proposal line breaks change. Both native receipts report full text
visibility, two lines and the exact admitted font without fallback. The
[comparison](../evidence/caption-proposals/comparison.json) retains full PNGs,
matched enlarged caption crops, actual nonbackground bounds and pixel metrics.
The candidate keeps “their source pins.” together; control isolates “pins.”.
[Fresh independent visual critique](../evidence/caption-proposals/visual-critique.txt)
found both readable and safely placed without clipping, with the candidate more
balanced. This is one Latin fixture, not general multilingual glyph-fit evidence.
Saved shots support reversible acceptance of this chosen proposal.

Preview's launch command was accepted in the parent's shared shot set. Actual
window visibility was not verified; scoped AppleScript cleanup hung and was
stopped, so no successful close claim is made. No further Preview sets were
opened. Saved images remain the reliable review surface.

## Choices handed to the parent ledger

All entries below belong to this slice's implementation pass. No unsound or
user-only decision remains; confidence ranks the sound entries below.

- **Bottom-center layout in caller safe area — sound, medium confidence.** Given
  a selected caption box and safe rectangle, the helper centers the unchanged box
  at the rectangle's bottom. It does not shrink text when the box is too large;
  it reports a violation. The plan did not choose placement within that rectangle.
  This makes a predictable ordinary draft without assuming a platform's margins;
  the caller can replace the geometry. Future automatic positioning remains
  outside this helper.
- **Envelope dwell and visible support diagnostics — sound, medium confidence.**
  A word can survive in two separated project fragments. The proposal retains
  both, keeps that word separate and marks it discontinuous. Dwell is the enclosing
  time from first support to last support, not newly invented continuous speech.
  The alternative would extend/rewrite timing or silently hide gaps. The plan did
  not define fragmented reading time; future continuous-support metrics must use
  the retained fragments and keep this scope explicit.
- **Offline complete-entry input — sound, high confidence.** If an agent has only
  half a transcript page or source-only words, the helper reports missing evidence
  and drafts nothing. It never fetches/prepares speech on its own. The plan left
  acquisition unspecified; requiring one complete compact project entry preserves
  the existing read owner and makes this helper portable with no new runtime.
- **Exact selected rows and literal corrections — sound, high confidence.** A
  caller may correct “hello” to “Hello” or explicitly display an empty string.
  Only selected rows change display; original source words/pins remain in evidence.
  Skipped rows split cues instead of sneaking unselected speech into an envelope.
  The plan allowed corrections but did not choose a request shape. Row indexes
  refer to one immutable pinned entry; no normalization or semantic rewrite occurs.
- **One occurrence/segment per cue — sound, high confidence.** Repeating the same
  source take twice returns two separate source-anchored drafts. Different
  occurrence IDs, speech segments and fragmented/partial words split. The plan
  required exact pins but left grouping boundaries open. Mixing them into one
  content anchor would misrepresent authoring, so existing occurrence identity
  remains the anchor owner.
- **Grapheme proposal and unverified native fit — sound, high confidence.** A
  combined accent or emoji counts as one grapheme, a user-visible text unit, but
  that count cannot predict glyph width in a selected font. The helper always
  retains an unverified-layout diagnostic. The fixture measures actual native
  layout only for its own explicitly applied Latin draft. No font service or
  speculative measurement API was added; future measured proposals need their
  own admitted-font contract.
- **Reported bounds without loss — sound, high confidence.** For 1001 selected
  words that fit one textual line, the existing seed limit requires two cues;
  all pins survive and the split is reported. Excessive total output refuses
  instead of truncating. The plan left work bounds unspecified. Incremental line
  state avoids quadratic prefix layout; the current limits belong to helper code.
- **Existing owners and no dependencies — sound, high confidence.** The helper
  reuses the consumer JSON/budget transport and returns existing clip/geometry
  drafts. The tiny proof reuses composition/native frame execution. The unbuilt
  alternative would add a caption service, queue or third-party text engine.
  None is necessary for pure caller-constrained proposals, so later application,
  persistence and exact rendering stay with their current owners.


Independent Codex code review reproduced two failures beyond the initial passing
checks: valid instantaneous projections aborted all proposals, and wrapping
silently removed a meaningful separator. Both were observed red through the
consumer function and fixed; all 25 focused checks then passed. No finding was
dismissed. The [review](../evidence/caption-proposals/code-review.txt) retains the
original diagnoses. The saved native visual operand is unchanged by these fixes.

- **Instant words stay evidence without placement — sound, high confidence.**
  An ASR word may have a positive retained raw pin but project to a single instant.
  The helper now isolates and reports that observation with `clip: null` rather
  than failing surrounding ordinary words or inventing positive cue time. The
  plan did not explicitly cover point projections. This extends the draft result
  shape only for unplaceable evidence; callers must inspect violations and apply
  only placeable chosen drafts.
- **Meaningful separators survive wrapping — sound, high confidence.** When a
  caller explicitly joins words with “ · ” and they exceed one line, the separator
  remains at the next line's beginning, possibly with a width violation. Replacing
  whitespace with a line break is layout; deleting the bullet would change chosen
  display text. The plan did not settle arbitrary separators. No text is removed
  to satisfy width limits.


Closeout review: refactor-clean kept one cohesive pure proposal owner and reused
the existing JSON transport; incremental line state removed measured repeated
prefix work. Code review resolved both independent findings. Documentation links
resolve through README → consumer skill → creative workflow → helper; current
request shape stays in helper help. Changed-file lint, formatting, staged
whitespace checks and help passed. An exact comparison of the final helper's
output against the saved render operand passed, so the unrelated edge-case fixes
required no repeated native render.
