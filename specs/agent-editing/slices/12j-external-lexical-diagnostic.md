# 12j — Independent utterance lexical diagnostic

Status: fixed baseline execution and saved qualification complete. The
[result](../assets/12j-external-lexical-diagnostic/README.md) preserves all lexical
misses and scoped evidence. Parent 12 remains open.

## Contract

Measure recognized ordered words and literal filler representation against full,
human-checked utterance transcripts without inventing acoustic word boundaries.
Use the selected unchanged Parakeet baseline and its existing native speech owner.
This is evidence characterization: no edit, alignment or model adoption occurs.

The primary [DisfluencySpeech paper](https://arxiv.org/html/2406.08820v1#S2)
describes transcript checking against the recorded audio and separates its
automatic alignment resources. The [original publisher dataset](https://huggingface.co/datasets/amaai-lab/DisfluencySpeech/tree/b7da294fe3a70dd96df6640893f2a5dfc2c87638)
provides complete utterances under its declared Apache-2.0 license. Use original
transcript A and explicit annotated `F uh/um` labels. B/C remove speech and cannot
serve as preservation references.

## Fixed gate

The qualified test parquet and extracted full WAVs live at
`/tmp/screenrec-12-external-corpus-qualification`; its qualification record pins
the original bytes, sample counts and complete PCM. Source-order selection takes
utterances with at least two explicit uh/um labels until forty labels, plus the
first eight zero-label utterances. Freeze this selection before inference and
retain all raw predictions, missing words, extra words and separate uh/um counts.
The enrichment is a bounded omission diagnostic, not a prevalence estimate.
Row 84's annotated `bo-` versus transcript-A `b-` is a retained reference ambiguity.
Do not select a reference version from predictions.

Use the existing sequence scorer's lexical entry point. Its normalizer and
ordered alignment have one owner; original timing evaluation keeps its explicit
boundary-distance tie rule. Text-only equal-edit-cost paths prefer more exact
matches. Lexical output supplies counts and indices, never a timing/adoption pass.

Run only metadata and one recognition request per whole utterance through the
unchanged frozen worker with verified local model files. Deny network and writes
to retained model homes, keep actual requests/replies and terminal events, use
60-second requests and a 360-second outer bound, and stop on the first failure.
No preparation, accepted-case replay, package installation in model homes,
reference rewriting or automatic inference retry is authorized by this slice.

## Limits and next pickup

This single human actor rereads conversational scripts; it supplies neither
spontaneous multiple-speaker coverage nor verified model-training exclusion.
It adds no independent word timing, silence interval, technical-name gate or join
listening. Preserve failed historical timing and all parent acceptance limits.
Reuse the complete result and its per-utterance omissions. Do not repeat this
cohort without a changed speech contract. Further timing, listening or model
adoption work needs its own independent authority; lexical success cannot supply it.
