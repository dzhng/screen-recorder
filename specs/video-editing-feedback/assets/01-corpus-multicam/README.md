# Multicam physical coverage checkpoint

`packages/test-harness/editing/multicam-corpus.mjs` is the public verifier for
the retained unlike-microphone input bank. It checks the frozen manifest
identity, decodable source stream declarations, all three 20-second windows
for each of Graham, Madison and Lily, WAV bytes and source-rate mono PCM
identities. The [receipt](receipt.json) is the current run.

This checkpoint certifies fixture coverage and physical input preservation. It
does not infer a shared camera clock, speaker identity or camera choice; the
result intentionally reports `synchronization: not-established`. Acoustic
research and its refusals remain owned by [slice 20](../../slices/20-sync-replication.md).
