# 20d4 — Explicit operational source-evidence retry

Status: verified; independent review has no actionable findings.
Dependencies: [20c](20c-sparse-capture-materialization.md), [20d1](20d1-recovery-continuation.md).

## Contract

A source-evidence attempt that cannot read its journal or canonical input because
of a known access/IO failure exposes a retryable error. Restoring access can permit
an explicit next attempt through the existing processing/job owner. Invalid media,
changed pinned identities, malformed journals and publication conflicts remain
terminal. Preserve NativeFailure's existing classification; do not import capture
finalization's unknown-error retry default into immutable admission.

The native source-export boundary translates only MEDIA_UNAVAILABLE,
JOURNAL_UNAVAILABLE and the existing positive NSError access/IO classifier. Its
initial journal stat distinguishes operational failure from missing/nonregular
input. The service's actual descriptor and inventory reads translate EACCES,
EPERM and EIO into retryable MEDIA_UNAVAILABLE; other failures retain their owners.
No catalog, JobTarget, lifecycle or automatic retry change is required.

## Identity and verification

The public gate uses a settled recording with real prerecorded writer output,
installed through the existing RevisionStore fixture. SourceProcessing.retry keeps
recording/source/job identity and creates the next attempt. That recording-owned
export has no frozen acquisition descriptor argument; it reads the source anew and
verifies the canonical bytes against retained publication proof. Journal and audio
permission restoration produces ready evidence with unchanged source byte hashes.
This is not permission to rebind an already admitted acquisition/import identity.

A separate service test pins a canonical descriptor identity: chmod changes ctime,
so the old identity still refuses after access restoration. Only explicitly fresh
admission succeeds. Native canonical denial/restoration and conflicting proof,
public corrupted canonical refusal, and the full native source-evidence suite
cover the remaining boundaries. No physical acquisition occurs.

Evidence: [20d4 source retry](../assets/20d4-source-retry/README.md) and
[integrated catalog17 replay](../assets/20d4-source-retry/root-verification.json).

## Scope retained

Parent20d remains open for settled cleanup replay and terminal explanatory
completion disclosure. The retained remaining-gates proposal documents the no-r0
maintenance target issue; this slice adds no maintenance operation or job schema.
