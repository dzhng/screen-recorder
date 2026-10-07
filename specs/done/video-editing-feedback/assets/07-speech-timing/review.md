# Slice07 scoped review

Verdict: shape, diff and docs reviewed; no unresolved actionable finding.

Shape: timing admission, retained rows and traversal keep their existing native/core
owners. The blanket clamp, synthetic one-microsecond expansion and disjoint-word
assumption are deleted. Full-source enumeration applies no interval filter;
explicit selections remain half-open. No table, endpoint, dependency, compatibility
reader, migration or renderer was added. The replay checkpoint is verification,
not a source-admission substitute.

Diff: deterministic invalid native operands refuse nonretryably with offending
indexes, original timing/confidence and support context. All-point text seeding
cannot infer dwell, even when selected points occur at different positions.
Overlapping words use the widest endpoint in source/project search and captions;
point/gap ties retain both records through one-row continuations. The persisted
catalog/transcript/project-read identities cut over together.

Docs: native/core contracts, public operation help and the consumer reference
explain overlapping estimates, exact points, pure-point cue refusal and selected
support limitations. Root-to-leaf documentation links were checked; no broken
local links were found in the touched documentation chain.

[Independent review](independent-review.md) returned no actionable defects and
passed type checking. Its targeted core tests were blocked by sandbox temporary-
directory permissions; that is a review-environment limit, not a test pass.
The [receipt](review-receipt.json) records exit zero and turn.completed.

## Focused proof

- [Core](core-tests.log):80 passing tests across native-response admission,
  source pagination/search, text seeds and project evidence.
- [Helpers](helper-tests.log):27 passing caption/compact-transcript tests.
- [Composition](composition-text-tests.log):3 passing text tests;
  core/composition/protocol type checks passed.
- [Native](native-build.log): own worker build; the six offline real calls passed
  with unchanged raw token arrays. Native merger/source mapping red/green logs
  cover contraction overlap and invalid/nonfinite/reversed/out-of-support operands.
- [Replay](replay-summary.json): tiny Madison and both25-second retained outputs
  preserved every lexical occurrence and exact operand through current admission
  and one-row enumeration. Raw native replay also failed after reinstating the
  old non-overlap gate, then passed after restoring the fix.

The neighboring red/green logs retain each regression's failing and passing
outcomes, including exact-rational caption envelopes, source terminal points and
point/gap ties. The source/input comparisons establish preservation rather than
phonetic accuracy; ASR can still change lexical recognition with nearby cut starts.

The whole suite remains deferred until this feature spec finishes. These checks
do not certify the complete slice01 corpus, live-device capture or a release.
