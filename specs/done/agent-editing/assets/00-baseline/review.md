# Corpus review

The independent Codex review of fixture commit `4cbd5a5a38233363fc67bb25f16ef7bc08cb4fdf`
reported no actionable correctness issues, reran all five fixture tests successfully,
and verified the committed corpus and referenced source hashes. The integrated
commit is `b1fc5fe`.

Root review checked generator, hand-authored oracle and decoded assertions. The
oracle owns expected membership; generation does not derive expected answers.
The corpus has no production dependency or compatibility path. Documentation
separates synthetic acquisition gaps from native empty edit-list gaps and scopes
byte determinism to the recorded toolchain. No further shape or diff changes were
needed. The independent final-image [visual review](visual-review.md) accepts
readability and orientation only; it does not prove timing or native decoding.

The preserved native baseline is deliberately red: two subprocess timeouts, with
53 other checks passing. Performance fixes must retain the original assertions
and timeouts and record separate post-fix evidence. Partial inherited speech
labels are not a completed speech-quality gate.
