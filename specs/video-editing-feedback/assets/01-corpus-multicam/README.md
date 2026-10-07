# Multicam physical coverage checkpoint

`packages/test-harness/editing/multicam-corpus.mjs` is the public verifier for
the retained unlike-microphone input bank. It checks the frozen manifest
identity, decodable source stream declarations, all three 20-second windows
for each of Graham, Madison and Lily, WAV bytes and source-rate mono PCM
identities, and three decoded 320×180 RGB samples per retained source from the
compact picture derivatives described by the sibling
`picture-manifest.json`/identity pair. The [receipt](receipt.json) is the
current run.

This checkpoint certifies fixture coverage, sampled picture behavior and
physical input preservation. The companion [source-choice behavior receipt](behavior-replay.md)
replays a caller-authored nine-selection schedule and binds each audio window
to its same-source picture sample. It does not infer a shared camera clock,
speaker identity or automatic camera choice; the result intentionally reports
`synchronization: not-established`. Acoustic research and its refusals remain
owned by [slice 20](../../slices/20-sync-replication.md).

The [native delivery receipt](native/report.json) now imports the three compact
retained picture sources through the public CLI/MCP path, authors all nine
caller-selected source/sample placements, and checks direct native frames plus
the encoded preview. Direct frames are compared against the same native source
read; preview comparisons use a declared bounded codec tolerance. This proves
retained-source composition and delivery, while synchronization, speaker
identity and automatic camera choice remain refused.

Reproduce it in a new empty directory with the native worker, then replay the
receipt without launching a service:

```sh
YAP_NATIVE=/absolute/path/to/yap-native \
  node packages/test-harness/editing/multicam-native-delivery.mjs run --out NEW_DIRECTORY
node packages/test-harness/editing/multicam-native-delivery.mjs verify \
  --report NEW_DIRECTORY/report.json \
  --fixtures fixtures/video-editing-feedback/synchronization
```

The retained report stores file hashes for every PNG and the MP4, plus decoded
RGB hashes and measured tolerances. `preview.fileSha256` is the MP4 identity;
`preview.rgbSha256` is the decoded nine-frame identity.
