# Retained project audio consumers

A moved project can play its already prepared output even when the processor that
made it is unavailable. PreparedAudioStore matches the complete compiled recipe
to the recorded policy and retains its original identities. Undo carries the
selected revision's prepared references; each read still checks compatibility.

Only processed output and its ranges reuse full-output PCM. Different matching
policies produce explicit ambiguity. Missing or changed compatible bytes remain
errors. Jobs pin either a particular retained resource or produced audio when
admitted; a later preparation cannot change that choice. Native delivery reads a
pinned descriptor in bounded blocks through existing WAV/movie sinks.

The original public failure was reproduced from a retained format2 package.
The catalog18 root replay verifies three historical revisions and undo with audio
capabilities unavailable: preparation, exact complete PCM, previews and movie
exports succeed. Earlier range PCM is exact; preview/export AAC decode identically
in the separate encoded comparison. This does not assert AAC equals lossless PCM
or establish listening quality.

Core controls cover changed recipe meaning, non-output taps, equivalent references,
different-policy ambiguity, missing bytes, produced-mode pinning and failed-render
FD release. Native controls cover exact stereo samples across multiple blocks,
malformed operands, mismatched range, changed identity and truncation. Root passes
39 focused tests plus the separately enabled12 native project-audio tests and two
native operand/plan tests. Independent review found an invalid test tap and missing
produced-mode pinning; both were repaired. Follow-up review found no actionable
regression and ran types, focused tests and native operand checks.

[root-verification.json](root-verification.json) records integrated scope. Compressed
scripts/reports retain exact historical paths and setup; source packages remain in
[the preparation transfer evidence](../14a-learned-portable/README.md). The manifest
authenticates retained files. Large prepared-recipe package limits, broader package
acceptance, arbitrary processor policies and full editor acceptance remain separate.
