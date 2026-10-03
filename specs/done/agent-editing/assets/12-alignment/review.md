# Focused review

Shape: one research runner invokes the official aligner API; it strips source
word times before inference. Both experiments consume one unchanged scorer.
There is no production dependency, model downloader, fallback or engine switch.

Diff: four scorer/adapter tests pass, preserving missing/ambiguous and shifted
boundary controls. Exact rescoring reproduces the retained result. Executed
runner, PCM, transcript and output hashes agree; all 306 normalized supplied
words survive in order. The earlier source-origin mutation control stays red
under the shared evaluator; this pass does not change evaluator behavior.

Docs: the owning slice and experiment leaves agree that p95 and memory fail.
No word discovery, full cleanup, listening or visual acceptance is inferred.
The next experiment contract preserves the failed boundaries and labels.

Independent `codex review --uncommitted` completed with no actionable defects.
It reran all four tests, rescored the retained output and checked runner/result
hashes. It did not rerun inference. Log:
`/tmp/screenrec-speech-align-review.log`.
