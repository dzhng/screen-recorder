# Speech timing evidence

This directory binds independent listening marks to source media and compares
candidate word boundaries against them. The [speech evaluation protocol](../../speech/protocol.md)
owns lexical alignment and score interpretation; these tools supply the source
clock and independently marked endpoints that model output cannot supply itself.

A transcript proposal can help locate a word, but its text and timing are not
independent truth. Match repeated words as occurrences, preserve neighboring
speech, and report missing or ambiguous matches instead of inventing an endpoint.
A marked subset cannot establish complete filler accuracy or repetition intent.

The [annotation binding](annotation-time.mjs) owns conversion from clip-relative
positions to the source clock and refuses marks from another packet. The
[marking page](annotation-page.mjs) is an optional interactive input tool for an
explicit listening task. Saved annotations stay bound to the original media;
verification does not require re-recording it.

The [frozen alignment references](../../../../specs/done/agent-editing/assets/README.md)
measure supplied evidence independently. Comparing
models, comparing aligned words, checking retained PCM and judging a cut by ear
are different claims. The candidate's timestamps must never become the reference
used to accept that same candidate.

The runner owns input formats and invocation. Model preparation and inference
remain explicit work; a file-based scorer can reuse valid retained results.
Keep raw candidate output separate from human-reviewed evidence, and preserve
unverified endpoints as unverified.
