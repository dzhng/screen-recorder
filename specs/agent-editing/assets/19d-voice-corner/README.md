# Combined voice resource corner

The single candidate combines a twenty-second synthetic reference, 1,024 actual
target-text tokens and a 512-code output budget. It exercises the entire output
budget and stays below the unchanged 12 GiB target: MLX peak is 12,019,397,353 bytes,
versus 12,884,901,888 allowed. Process peak RSS is 2,771,976,192 bytes; the earlier
[resource failure](../19d-voice-envelope/README.md) explains why RSS alone cannot
establish the Metal allocation bound. The original 1,024-code failure remains red.

This is resource evidence, not a successful complete-utterance example. The actual
loop reaches budget exhaustion without EOS, returns 512 generated codes and
983,040 samples (40.96 seconds). Default public generation must not publish that
as complete. Neither a budget stop nor EOS alone determines lexical correctness.

## Inputs and interpretation

The reference repeats the frozen five-second PCM and corresponding transcript four
times. It is not twenty seconds of continuous speech. The exact retained reference
member and hash live in [the prior envelope archive](../19d-voice-envelope/evidence.tar.xz)
and are identified by [this report](report.json). Target text repeats complete
familiar sentences; actual tokenizer counts are the authority.

The observer sees 480,000 reference frames, 250 reference codes, forty reference-text
tokens and 1,024 target-text tokens. The actual English prefix yields 1,325 prefill
positions. This tests the previously missing joint corner, rather than composing
independent limits without evidence. Other references, languages, sampling settings
and devices do not acquire universal memory or quality guarantees from this sample.

The exact restored model was supplied explicitly from its durable local path and
all pinned model/runtime checks ran before generation. No model version, runtime,
production worker or numerical setting changed. The 19c inference/lifecycle window
finished before this process started. Root24j package I/O could run independently;
its absence was not assumed. Start disk availability was 71,412,494,336 bytes.

Wall time was 22.66 seconds. The child separately measured 0.99 seconds of preparation
verification, 1.61 seconds of model loading and 19.17 seconds of generation with the
observer. These are diagnostic fresh-process timings with existing caches and
possible host concurrency, not cold-cache measurements or parent RTF acceptance.

[The archive](evidence.tar.xz) retains the complete output, request, original receipt,
RSS observations, process snapshot, logs and exact one-case controller. Every member
matches [its size and SHA256](artifact-files.json). No follow-up candidate ran.

This result supports considering a 512-output-code / 480,000-reference-frame /
1,024-target-token / 1,325-actual-prefill profile on this measured runtime. Typed
adoption remains separate: minimum-reference behavior, numerical representation,
exact tokenizer/template identity and model-dependent failure handling still need
an explicit contract. No public capability is enabled by this evidence commit.

Independent [review](review.log.gz) confirmed archive hashes, retained reference
identity and report consistency; no production change or broader claim was found.
