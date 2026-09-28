import type { Job, JobLane, JobQueue } from "./jobs.js";
import type { DerivedCache } from "./cache.js";

/** Published metadata does not make an evicted derivative ready. Regeneration keeps the same
 * pinned job identity and uses the queue's existing generation/retry policy. */
export function submitCachedDerivative<Value extends { cacheId: string }>(
  jobs: JobQueue,
  cache: DerivedCache,
  identity: Pick<Job, "target" | "artifact" | "input">,
  lane: JobLane,
  admitted?: (job: Job) => void,
) {
  jobs.submit({ ...identity, lane }, admitted);
  let status = jobs.status(identity);
  if (status.published) {
    const read = cache.acquire((JSON.parse(status.published.result) as Value).cacheId);
    if (read) read.release();
    else {
      jobs.regenerate(status.jobId!, status.published.generation);
      status = jobs.status(identity);
    }
  }
  return {
    state: status.state,
    reason: status.reason,
    retryable: status.retryable,
    jobId: status.jobId,
    published: status.published
      ? {
          generation: status.published.generation,
          value: JSON.parse(status.published.result) as Value,
        }
      : null,
  };
}
