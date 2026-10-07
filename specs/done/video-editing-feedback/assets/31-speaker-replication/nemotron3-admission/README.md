# Nemotron-3 speaker admission refusal

Status: **refused before inference**. This is a distinct first-party NVIDIA
candidate, not a promotion of the tested 4-slot Sortformer or Ultra8 weights.
The checkpoint downloaded successfully, but the sealed Yap speaker runtime cannot
restore its NeMo 3.0 model configuration. No short or long quality result is
claimed.

## Candidate

The candidate is `nvidia/Nemotron-3-Diarization` at Hugging Face revision
`f667ed73aee57d40cc39428eb768b4fd87a0a29e`. NVIDIA's model card describes an
8-slot streaming/offline diarizer with direct frame probabilities and an
80 ms output clock. Its `.nemo` artifact is 198,676,480 bytes and was downloaded
into the isolated preparation workspace. The retained local artifact hash is in
`protocol.json`; the model is deliberately not copied into Git.

The model archive declares `nemo_version: 3.0.0` and targets
`nemo.collections.asr.modules.TransformerEncoder`. The existing first-party Yap
runtime is pinned to NeMo 2.7.3, Torch 2.8.0 and NumPy 2.3.5. Restore failed before
loading weights because that runtime has no `TransformerEncoder` symbol at the
declared import path. Pointing `PYTHONPATH` at NVIDIA NeMo Speech main
(`50c71dbe1534a89e0d07fe66fbffd205408062ad`) exposes the symbol, but that source
tree requires `lhotse.indexing`, which the sealed runtime's lhotse 1.33.0 does not
provide. Installing or changing either dependency would create a new runtime and
must be prepared, hashed and reviewed as a separate candidate.

## Frozen next attempt

Prepare a relocatable NeMo 3-compatible runtime (including the matching lhotse
release), keep the checkpoint revision and the model-card 30.4-second recipe
fixed, then run the existing short controls in their preregistered order. Do not
change thresholds, add count hints, or open the long controls until every short
DER, identity, overlap, count, time and RSS gate passes. If the prepared runtime
cannot reproduce the model's declared contract, retain another refusal rather than
altering the production speaker runtime.

`protocol.json` is the machine-readable boundary for this attempt. It records
successful acquisition, exact hashes and the pre-inference runtime error; it does
not authorize model registration or public speaker promotion.
The inference-free replay is
[`nemotron3-admission-replay.mjs`](../../../../../../packages/test-harness/editing/nemotron3-admission-replay.mjs);
it rejects edited identity, runtime errors or promotion state.

A follow-up source-overlay admission is retained in
[Nemotron-3 short-gate evidence](../nemotron3-admission-short-gate/README.md).
That exact checkpoint restores and runs offline when the selected NeMo and
Lhotse source trees are layered over the sealed runtime, but one unchanged short
control misses overlap recall. The source overlay is therefore not a production
runtime and the provider remains refused.
