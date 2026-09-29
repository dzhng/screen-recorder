# Retired source-job reference history

Status: scoped lifetime gate passed without a production change. The actual
service imported the retained corpus WAV and completed513 distinct native
selected-source jobs. Public cancellation, a service crash and restart kept
references attached to the surviving identities. After the service closed, the
existing JobQueue explicitly forgot only the selected drained history, in257/256
phases separated by a public-service restart. The final reference set contains
exactly the import, ready, canceled and interrupted sibling jobs.

This is **not a public asset-retirement operation**. The service exposes no such
command. Public CLI/MCP owns creation, inspection, cancellation, retry and output
delivery; a separately reopened core queue owns the explicit test retirement.
No database row is manually edited and no new endpoint, janitor or expiry policy
is introduced. The queue's target/admission/executor callbacks fail if called;
its ordinary capture-state query returns false because this fixture has no capture.
There is only one active service/queue owner at a time.

The [summary](summary.json) records native/source/harness identities and timings.
[evidence.tar.xz](evidence.tar.xz) retains full public traces, exact job/reference
sets, the delivered before/after WAVs, logs and focused test results. Every
forgotten identity is absent from the core queue; public inspection confirms the
partial restart boundary. No orphan `job` or `job-input` owner remains. Both
canceled and interrupted siblings explicitly retry using the same IDs. The ready
sibling's delivered WAV remains byte-identical and the source asset is unchanged.
A separate [full managed-source hash](managed-source-check.json) confirms the
retained imported file still matches the original content identity.

The reference checker is deliberately run against the actual unretired snapshot
and must fail before retirement. A fixture-only first attempt completed all native
jobs but stopped before retirement: its guard rejected the constructor's capture
query. That red is preserved; the corrected complete run passed. The focused nine
existing queue tests also pass at their unchanged deadlines, including populated
job-input reference pages and attempts that have not closed. This source-audio
cohort itself creates ordinary asset references, not populated job-input pages.

Public setup took40.855s. The two internal retirement phases took115.65ms and
110.33ms, including reference inspection. These are observed timings, not new
acceptance thresholds or a claim about all history sizes. Existing public poll
and service shutdown deadlines were unchanged. Cache files and cataloged assets
may remain after forgetting a job; neither this result nor reference release
promises physical asset collection. Parent24's other scale gates and installed
cutover remain open.

Reproduce against the existing worker, with a fresh output directory:

```sh
SCREENREC_NATIVE=/absolute/path/to/screenrec-native node packages/test-harness/editing/job-reference-retirement.mjs --out /absolute/new-output
```

No model, speech inference, prepared DSP, two-hour render, transfer, playback or
installed user state is used. The success library remains in the scratch path
recorded by the summary for independent inspection.
