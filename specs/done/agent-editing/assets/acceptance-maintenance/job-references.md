# Job-reference lifetime reconciliation (23/24)

Read-only audit of `/Users/david/dev/screen-recorder` at `e518fe49`. No production/spec edits, builds or tests were run. Test descriptions below are existing source-level proof, not a claim of a fresh test run.

## Finding

The slice23 sentence saying `JobQueue.forgetJob` does not own reference release is stale. Since commit `46da372e` (Materialize project screenshot indexes with retained job inputs), `packages/core/src/jobs.ts:861-879` releases both `job` and `job-input` owners, deletes the artifact identity, and deletes the job inside one catalog transaction. It rejects queued/running/waiting jobs and any still-live attempt, including canceled workers. `Catalog.transaction` uses an immediate transaction and rolls back on failure. This already implements the named single-job no-orphan contract for every ResourceKind, including asset/acquisition references.

No reachable production path that forgets a drained durable job while leaving its own resource-reference rows was found. The smallest necessary action is documentation reconciliation, not another cleanup owner or production change.

## Reachable retirement triggers

| Trigger | Actual owner and behavior | Reference disposition |
| --- | --- | --- |
| Public `export.abandon`; project/recording deletion; resumed fenced export cleanup | `apps/service/src/exports.ts:267,1148-1245` fences intent, drains primary and recovery jobs, removes private staging/assembly, then calls `forgetJob` | Queue atomically removes each job's references; export-intent references are a distinct `export` owner, removed with the intent in its own transaction after cleanup. A crash between these steps leaves a fenced intent for recovery, not an orphan reference without a recovery owner |
| Public `project.delete` and recording deletion, plus startup deletion recovery | `apps/service/src/project-deletion.ts:39-60`, `deletion.ts:64-77`, `JobQueue.forgetOwner:899-935` | Deletion fence denies retries; all attempts drain. Job/reference cleanup proceeds in pages; each job marker is deleted only after both reference-owner kinds are empty. Project revision references are retired later by `ProjectStore.finishDeletionPage` |
| Package render-slot pressure, released package output, closing package handle | `package-media.ts:225+`, `package-registry.ts:266`, `JobQueue.forgetContextJob:493` | These are in-memory context jobs, not durable jobs in the catalog. The package context/output owner holds their files and drains closure. No durable `job`/`job-input` resource-reference policy is bypassed |
| Asset audio/transcript/frame/scenes/source-index normal reads, cancel, retry, derivative cache eviction | Domain admission retains durable identities; no production source-asset retirement caller found | These events do **not** forget the durable job. References remain intentionally attached to an existing identity; cache loss uses regeneration of that identity. They are not forgotten-job orphan leaks |

Search found only the export primary/recovery paths calling durable `forgetJob` in production. Durable `DELETE FROM jobs` occurs only in `forgetJob` and `forgetOwner`. Tests also invoke `forgetJob` directly to exercise loss/recovery semantics. There is no current public asset-delete/asset-GC/job-forget command to assume here.

`forgetOwner` is deliberately different from the single-job transaction: it releases 256-row reference pages with yields, then deletes each job, and removes artifact rows in pages. Its deletion tombstone and remaining job rows preserve forward progress across interruption. It does not promise an all-owner single transaction, but it cannot delete a job marker first and strand its references afterward. Wrapping the entire owner history in one transaction merely to match literal prose would undo bounded deletion. The spec should state this distinction.

## Which resources are owned, and why they remain

- **Source audio** (`audio-inspection.ts:247-259`): asset and optional acquisition references under `ownerKind=job`. They survive completed/canceled/failed states while the recipe identity remains. `submitCachedDerivative` probes real cache presence and regenerates missing bytes using the existing identity; deleting cache bytes is not retirement.
- **Source transcript** (`transcript-processing.ts:384-400`): same durable job asset/acquisition references. Transcript generation reclamation separately keeps current publications/live attempts and `transcript-generation` references held by revisions, packages or other owners. Source generation cleanup does not delete job identities.
- **Source frames/scenes/index** (`frame-inspection.ts:370`, `scene-processing.ts:224`, `index-processing.ts:506`): asset/acquisition ownership is durable `job` ownership. Index preparation additionally pins scene generations under `job-input`. Screenshot-index generation reclamation checks both the owner's published/active generation and `index-generation` references before removing files. A revision-pinned generation legitimately survives job disappearance.
- **Project index and prepared audio**: preparation dependencies use normalized `job-input` references, retained atomically with admission. `releaseFinishedInputs` releases them only for nonretryable terminal jobs after every overlapping/canceled attempt closes. Retryable failures and explicit cancellation keep the inputs. Prepared publication transfers durable asset/prepared-audio and upstream dependency ownership to the revision in the queue publication transaction (`prepared-audio.ts:195-235`). Forgetting the job does not erase revision/history ownership; project deletion retires those revisions separately.
- **Exports**: processed-package resource closure belongs to `ownerKind=export` (`exports.ts:720`), not to the export job ID. Releasing it when just the job disappears would allow a still-recoverable/fenced export intent to lose prerequisites. Intent retirement releases it at the proper owner boundary. Uncommitted export admission is capped at32 per owner; recovery walks intents/jobs with advancing keys.
- **Asset import**: import results also retain the resulting asset under the import job (`project-service.ts:224`). No automatic import-identity expiration policy currently exists. This is another retained owner to account for if future asset reclamation is designed; it is not a dangling reference to a forgotten row.

`ResourceReferences` uses a normalized resource-first primary key and an owner index. `forgetJob` synchronously exhausts reference pages for one job in its transaction, so its cost is O(that job's references), not O(all historical jobs). Current production callers retire export jobs; large future asset-job sweeps must measure per-job fanout rather than infer a current bulk sweep. Owner deletion already yields between bounded pages/jobs.

## Existing proof and remaining limits

`jobs.test.ts` includes:

- “single-job retirement drains older canceled attempts before forgetting identity and result” (1691): an old canceled executor prevents premature forgetting.
- “preparation inputs survive canceled workers and explicit retry but retire with success” (2041): transient scene inputs release on success, durable asset reference remains while the job exists, and `forgetJob` releases it.
- Retryable failure/restart and old-canceled-attempt tests: inputs remain until the actual worker lifetime ends, even if a newer attempt finishes.
- “deleting a drained owner reclaims all ordinary and input reference pages” (2133): 513 transient references cross page boundaries; deletion cannot retire a still-closing owner and eventually clears ordinary asset references too.
- “settling one job cannot release a scene still pinned by another retryable job” (2165): one job's cleanup cannot release another owner's protection.

`prepared-audio.test.ts` covers project deletion with all revision dependency kinds and explicit job forgetting. `project-deletion.test.ts` checks asset references after deleting one project while another revision still owns the asset. Source index/transcript portability tests distinguish retained generation evidence from job identity. These are relevant safety proofs; they do not establish slice24's full large-retired-asset-job history/performance acceptance.

No new failure injection or performance measurement was run here. The audit does not establish every crash cut point experimentally or certify maximum dependency fanout. Successful reference release also does not imply immediate physical asset deletion: `AssetStore.recover` removes unpublished/orphan files lacking matching catalog metadata, not every unreferenced cataloged asset. There is no current reference-driven asset-byte collector to claim is blocked by forgotten-job refs.

## Smallest next action

1. Correct slice23's stale ownership sentence to name the queue's existing atomic `forgetJob` release of `job` and `job-input`; retain domain responsibility for fencing retries and releasing independently owned export/revision resources. Mention fenced, restartable paging for whole-owner deletion.
2. Keep slice24's large-history verification open, but aim it at the existing methods when an actual retirement trigger is in scope. Do not create a GC command/janitor merely to exercise the sentence.
3. Keep retained-job growth and future asset cleanup/expiry as explicit cutover policy questions. Define what identity may be forgotten and what replay/history behavior is intentionally surrendered before expiring rows. Current reads/cancel/cache eviction are not authorization to invent that policy.

No production fix is warranted by this audit. It found an already-implemented safety rule with stale planning prose, not a concrete reachable forgotten-job reference leak.
