# Native media worker deletion barrier

The [public worker deletion fixture](../../../../../apps/macos/tests/worker-deletion.test.mjs)
uses the packaged app, service and native media executable against generated video.
It stops an actual service-owned native process with `SIGSTOP`, while the catalog
confirms only the target recording has active media work. This makes cancellation
observable without a fake worker, production delay flag or capture device.

The public delete must end that process before the recording directory disappears.
The fixture observes both identities during deletion, then checks the deleted
recording is unavailable through both ordinary reads and storage inspection.
A previously indexed sibling still delivers identical PNG bytes, keeps its source
hash, and reports identical storage categories. The harness reaps every process it
owns before removing its scratch home.

[Generated receipt](worker-deletion.json) records the observed native worker,
active job, before/after usage and sibling hashes. Bypassing the coordinator's queue
drain reproduced directory removal with the held native worker still alive; restoring
the drain passes. This verifies the public route through the real media process
owner. It does not establish physical capture/audio, installed distribution, or
long-recording performance guarantees.

The shared harness accepts `ESRCH` only when an already verified owned process
exits between the identity check and its termination signal. Other signal errors
remain failures; the final absence check still must pass. This closes an observed
cleanup race without weakening ownership checks.
