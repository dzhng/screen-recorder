# Independent recognizer check of generated words

The existing native Parakeet recognizer reads the two distinct frozen generated
outputs and the actual five-second reference. Its word sequences match the
requested word “paid”, phrase “This is available at no cost.” and supplied
reference transcript. The [report](report.json) retains actual text, normalized
tokens, file/model/native identities and elapsed time. Normalization only ignores
case and punctuation; no wording substitutions are allowed.

This is recognizer agreement, not listening evidence. It cannot establish
pronunciation, intelligibility to people, speaker identity, prosody, or natural
joins. The other origin runs have identical audio hashes; no managed origin
lifetime claim is added. The short-word run emitted a Core ML shape diagnostic
while returning a successful transcript; its complete native log is retained.

Run the [probe](../../../../packages/test-harness/editing/voice-lexical.mjs) with
explicit --evidence, --out, --model-home and --native paths. The recognizer must
already be prepared. Inference runs with network denied, uses bounded worker
requests and exits unsuccessfully on a generated-word mismatch. It never downloads
models, plays audio, or modifies the frozen synthesis evidence.

The first request took about 57.6 seconds, subsequent phrase/reference requests
about 2.2/2.3 seconds. These are individual whole-process observations, including
model loading, not generation performance or a percentile budget.

A second complete run reproduced all three word sequences. Removing the phrase
run from the input manifest [fails explicitly](missing-output-red.txt); a partial
generation cannot earn agreement by checking only surviving outputs.
