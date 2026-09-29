# Independent processing batch evidence

The original admitted1,000-operation edit returned public TIMEOUT after15.01s,
then committed once. Exact replay returned its one revision. The unchanged public
deadline is the10s default plus5s transport margin. A500-operation success at10.03s
is pressure evidence, not an earlier refusal.

CPU profiling of that exact request on a pre-edit fixture copy attributed93.6%
of sampled service time to applyBatch. Complete composition resolution and whole
stack diffing dominated; there was no native/DSP work in that authoring probe.
Inclusive CPU figures overlap and must not be summed.

The changed public gate uses public restore inside a copy of the retained fixture,
verifies the complete input document, then submits the same1,000 operations under
a fresh required envelope. It returns in about one second, with an edit receipt
and document exactly equal to the original committed result. Replay adds no commit.
Full and late native PCM match all samples; removing the authored final0.5 gain
produces exact doubled PCM and differs from identity. These are local observations,
not whole24 or a new budget. Group depths16/128/1024/4096 retain full media/receipts.

The frozen original owner comparison covers29 processing cases, including ordered
geometry, stateful fallback, labels/IDs, no-op/clear, invalid prefixes and later
repair/construction errors. The prior44 placement comparisons also pass. A receipt
index countercontrol fails for the expected reason. Independent Codex review found
no actionable defect and passed236 composition tests/typecheck; it inspected but
did not execute native replay. Author focused95 tests and actual native/public
replay pass. Root reviewed the narrow owner extraction and harness.

Two scratch harness errors are preserved separately: revision.parentId does not
exist (corrected with ordinal/head checks without re-execution), and an assumed
final gain2 was actually0.5 (corrected explicit-factor oracle). Neither is a
production failure or a relaxed PCM tolerance.

[verification.json](verification.json) gives the source/native identities, commands,
and archive hashes. [manifest.json](manifest.json) authenticates every member.
`fixture.tar.xz` retains the quiescent generated home and original request; extraction
allows the public replay without reconstructing deep setup. `evidence.tar.xz`
retains reports, media, exact requests, CPU profiles, original owner and review.
The harness copies its input home before starting a service and removes only its
successful scratch copy. Original red fixture remains untouched.

No schema, timeout, native recipe, queue or processing domain changes. Stateful
batch performance, wide routing, queue saturation and full preview/inspection
budgets remain open.
