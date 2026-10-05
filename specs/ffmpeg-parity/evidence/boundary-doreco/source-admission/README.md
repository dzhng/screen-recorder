# Original source and clock admission

The [bindings](bindings.json) connect the unchanged original word annotations to
the physical sample clock and selected original bytes. The cohort was frozen
before audio acquisition: part1 supplies development, and fixed part2 windows
remain confirmation. Its [selection](source-selection.json) and
[acquisition checks](acquisition-checks.json) retain that ordering independently
of any provider or observed quality.

The [acquisition receipt](acquisition-receipt.json) records SHA256 over each
complete primary WAV response, without keeping whole source files. Only the
selected interleaved PCM and independently acquired source headers remain in
`selected-operands.tar.xz`; the bindings own member hashes and exact byte/sample
ranges. Complete source hashes describe the observed primary responses, not an
independently published checksum or signature. Source identity/header checks and
complete byte counts passed before those windows were admitted. The bounded
[acquisition script](acquire.py) and lossless progress log preserve the procedure.
An acquisition failure cannot authorize an unchanged retry or a partial binding.
The [retained verification](verification.json) checks archive members and reconstructs
original labels, immediate neighbors and sample-clock arithmetic independently.

The complete original master EAFs and dataset documentation remain in the parent
`annotations.tar.xz`. [Selected labels](selected-labels.json) preserve original
values, IDs, clipped intervals and immediate neighbors. Every label also has an
exact rational mapping from original millisecond units to the 44100 Hz source
clock and window-local samples; fractional samples retain timestamp resolution
rather than fabricating sample-accurate human precision. Row counts include
pauses and marked material. They are an inventory, not a lexical denominator.

EN01 is mono. EN03 has two original channels whose selected sample bytes differ;
both remain retained and their attribution is ambiguous. No channel or downmix
was chosen from energy, and no model or listening resolved the ambiguity.
Provider, lexical/special-label/partial-support scoring and declared channel
interpretation must freeze before inference. This checkpoint proves byte and
clock authority; it does not establish endpoint accuracy, annotator precision,
sound quality or general speech support.
