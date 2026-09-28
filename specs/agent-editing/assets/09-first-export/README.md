# Public project video export evidence

The [report](report.json) retains an actual CLI/MCP run through the isolated
project service, native movie renderer, shared derivative cache and publication
owner. All checks passed and the service exited normally. The exported
[pinned movie](pinned.mp4) is byte-identical to the independently decoded
[full preview](full-preview.mp4), including its protected pictures, both audio
channels, processed gain chain, inserted narration and retained impulses.

An omitted revision is pinned before a later edit. Replaying the same export
identity through the other transport retains that revision; changed arguments
conflict. Discovery traverses all four intents with one-item pages, passing each
returned cursor unchanged between CLI and MCP. Public abandonment then removes
one committed intent from status and filtered discovery while retaining its
external file. Retry, abandonment and subsequent project deletion retain external
hashes and inode identities.

## Controlled interruption evidence

The service fixture forwards every native call unchanged except for explicitly
armed, one-shot timing barriers. It does not fabricate rendered bytes, native
results or publication receipts, and does not change worker deadlines.

The precommit barrier admits cancellation before calling the real commit worker.
The destination is absent both at that boundary and after actual recovery work
drains; only an explicit retry publishes it. The postcommit barrier withholds the
real successful native reply. At that point the harness reads the actual prepared
receipt, verifies the complete external file, and confirms that public status has
not acknowledged it. Killing and restarting the service recovers that same
receipt without replacing the file. A separate cancellation at this boundary
also preserves the authoritative commit. Observer hits, receipts, hashes,
process exit and recovery results are retained in the report. These are
controlled fault experiments, not claims about winning an ordinary timing race.

## Scope and review

The run's automatically generated visual-review reminder is resolved by
[exact identity](visual-identity.json): all nineteen contact sheets and crops
match the [reviewed preview evidence](../09-first-preview/README.md) byte for byte.
The original observer/presentation discrepancy remains documented there; this
pass does not claim a new unanimous visual verdict. Export adds no new picture
content. Native media decoding and publication checks remain separate evidence.

[Runtime identity](runtime-identity.json) records the actual root-built artifacts
used by the isolated harness worktree. Machine-specific setup symlinks were
excluded from the commit. Independent Codex review flagged only those setup
symlinks; no harness logic finding remained. Existing oracle/process countertests,
syntax, formatting and lint checks passed. The retained [first tracer failure](failures/path-canonicalization.json) compared
`/tmp` with the admitted canonical `/private/tmp` destination; the fixture now
resolves its destination before sending the request. The retained
[interruption tracer failure](failures/recovery-drain.json) judged the canceled
job while its separate recovery job was still queued; the harness now waits for
that real recovery job to complete before checking the durable receipt. Both
were harness-only corrections; no production workaround was added.

This covers project video export through the development project-service entry.
Recording/package export, production capture cutover, and later processing/media
planes retain their own gates; this report does not close the entire editing plan.
