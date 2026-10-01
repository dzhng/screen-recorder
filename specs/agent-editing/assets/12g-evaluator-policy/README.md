# Evaluator policy evidence

This packet verifies [12g](../../slices/12g-evaluator-policy.md) against base
`a154899af4f2404da366562dec9c1463ce9ee965`. It proves the evaluator's policy and CLI
status contract using authored inputs. It supplies no human speech-quality proof,
improved selected baseline or full12 acceptance. The selected model and historical
reports remain unchanged.

The original actual `evaluate` CLI returned exit 1 for an optional canonical filler
omission and 75% held-out precision/recall. The corrected CLI returns exit 0 for
the same complete synthetic cohort. Both reports retain TP 30, FP 10, FN 10,
identical Wilson intervals and all 70 zero-error boundary samples. Omitted fillers
remain visible in `missedFillers`; only explicit required labels enter
`missedRequired`. Required canonical fillers appear in both arrays and still fail.
Held-out/walkthrough required omissions retain their diagnostic-only behavior.

The final focused command is:

```sh
node --test packages/test-harness/speech/evaluate.test.mjs
```

All 13 tests passed. Fourteen additional actual CLI controls preserve the
40-label/two-clip coverage, provenance, audition, warm-resource and timing gates,
including incomplete evidence remaining pending. Syntax, scoped lint/format and
the local core/composition dependency builds passed. The latter only supply the
CLI's own emitted registry imports; no model owner or inference runs. These
fixtures deliberately exercise the `origin: human` branch using `unit-test`
identities and fabricated metadata. Their labels are test inputs, not human marks.

[verification.json](verification.json) contains complete before/after outputs,
exact commands, source/base pins and every archive member hash.
[evidence.tar.gz](evidence.tar.gz) contains 94 members (54,507 bytes), SHA-256
`82d54a712e33b3590ab86537a0de3058574bd2c65f8b99363bb5405e44375efc`.
It retains the original failed regression, corrected output, all CLI inputs and
results, runtime identities and the changed closure. Eleven historical evidence
and native speech trees are pinned without copying or modifying their data.

An initial provenance probe removed runtime identity from only one run and hit the
existing mixed-configuration refusal. Its inputs, stderr and failed probe log are
retained separately. The corrected probe removes network provenance without
changing compared identity and verifies pending status; this required no product
change. [choices.md](choices.md) records the reviewed fixture and oracle decisions.
No media, model, download, capture, UI or audition was executed.

The [merged verification](merged.json) owns root integration checks and independently
verified child source/payload identities. Its [packet](merged.tar.gz) retains actual
merged logs and scope; it does not extend the child claim to full release acceptance.
