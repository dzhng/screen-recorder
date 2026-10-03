# Voice resource envelope: retained memory failure

**The proposed 1,024-token output budget failed the unchanged 12 GiB target.**
Seven cases completed; the combined eighth case was not run. No public reference,
text, prefill or output limits are adopted by this checkpoint.

The expanded observer first preserved the complete frozen phrase WAV exactly.
It then recorded actual reference codec length, reference/target text token counts,
input-embedding prefill length, actual EOS or budget exhaustion, returned token
counts, output samples, process RSS and MLX peak allocation. The runtime, model,
private production entry and generation arithmetic were unchanged.

## Measured boundary

The largest completed case used the original five-second reference, 1,024 target
text tokens, 1,108 prefill positions and 1,024 output tokens. It exhausted the
budget without observing EOS. Its complete 81.92-second output is retained for
diagnosis, not publication or a claim that the requested text was fully spoken.
MLX reported **13,572,007,721 bytes**, above **12,884,901,888 bytes**. Process peak
RSS was only 2,785,329,152 bytes. RSS polling therefore did not bound the model’s
Metal allocation; the final MLX guard failed and stopped the sequence.

The preceding 512-output-token case reported 9,583,071,445 MLX bytes. References
of ten and twenty seconds were tested only with the short familiar sentence.
Those references repeat the exact original five-second PCM and transcript two or
four times: they are synthetic repetition, not continuous longer speech or proof
of equivalent voice quality. Longer target texts likewise repeat complete familiar
sentences; actual tokenizer counts, not character estimates, select their lengths.

[The report](report.json) retains every case, including the unrun corner. In this
English ICL path the observed prefill is eleven prefix positions plus reference
text tokens, target text tokens and reference codec positions. Actual shapes are
the authority; model configuration position counts are not public capacity claims.
The source uses whole reference context and the nonstream decoder combines
reference and generated codes. A smaller output budget still needs a combined
reference/text/output corner before independent upper limits may be composed.

## Numerical controls

The [sampler-only probe](numerical.json) uses synthetic logits in the actual
bfloat16 dtype; it loads no model weights. Finite temperatures 1e-45 and 1e-38
produce positive-infinite logits while the sampler still returns a token. Thus
finite JSON numbers alone do not establish numerically usable settings. More
ordinary probed values and top-k/top-p cases do not establish arbitrary numeric
quality ranges. The actual MLX binding accepts unsigned 64-bit seeds, rejects
negative/out-of-range integers and floats, but accepts Python booleans. Public
validation must reject booleans and preserve integer identity through JSON.

## Evidence and limits

[The archive](evidence.tar.xz) retains every completed WAV, both repeated reference
WAVs, all eight planned requests, actual process RSS samples, output receipts,
controllers, observer and numerical-probe source. Every member was verified by
[size and SHA256](artifact-files.json). No eighth output is invented. The archived
controllers describe this exact experiment and original failing guard, not a new
public workload runner; no permanent alternative model executor is introduced.

All runs were fresh processes with existing system caches. Reports separate
preparation verification, model loading and generation-with-observer time. Cold
cache cost and the observer’s incremental overhead were not independently measured;
these figures do not establish warm-resident inference or the parent RTF target.
No listening or lexical acceptance is inferred from EOS, duration or memory results.

The initial disk-capacity snapshot was not retained. Low free space observed after
the run is a separate host-capacity constraint, not evidence of what caused the
MLX peak. Further inference is paused until capacity is restored and the next
candidate is assessed against both MLX memory and available host resources.

Independent [review](review.log.gz) verified syntax, every archived hash, report
consistency, observer identity and frozen-WAV parity without rerunning inference.
