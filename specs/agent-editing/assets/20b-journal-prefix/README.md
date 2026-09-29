# Validated journal prefix identity

The accepted-PCM reader now returns a package-only byte count and SHA256 for the
exact validated, newline-terminated prefix. It hashes original bytes in the
existing bounded decoder loop. Corrupt or torn suffixes are excluded; whitespace
is preserved. Later valid records produce a new token without invalidating the
earlier prefix of that same file. No re-encoding or second parser defines identity.

The token stays out of ordinary serialized inspection and does not prove media
commitment, canonical placement or durable publication. Those consumers must bind
it to verified media in20c/20d. Ordinary schema2 source inspection remains refused.

The default native capture suite covers complete, corrupt, torn, whitespace-varied
and extended journals. The original missing-token assertion fails; the implemented
reader passes. Independent read-only review found no actionable issue. The retained
token also matches an independent hash of the unchanged journal fixture in
[the format checkpoint](../20b-pcm-journal/capture.journal.jsonl).

Reproduce with the default `ScreenRecorderCaptureTests` product. Set
`SCREENREC_PCM_JOURNAL_OUTPUT` to a fresh directory to retain its journal and prefix
token. [Verification](verification.json) pins source and evidence hashes.
