import { setTimeout as delay } from "node:timers/promises";

export async function waitForObservation(
  predicate,
  label,
  { timeoutMs = 30_000, intervalMs = 100, interrupted, evidence },
) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const interruption = interrupted();
    if (interruption) throw interruption;
    const value = await predicate();
    if (value) return value;
    await delay(intervalMs);
  }
  throw new Error(`${label} timed out; ${evidence}`);
}

export async function waitForHealth(read, wait, expectedUpdateState) {
  let latest;
  try {
    return await wait(
      () => {
        try {
          const reply = read();
          latest = reply;
          return (
            reply.ok &&
            reply.data.status === "ready" &&
            (!expectedUpdateState || reply.data.update?.state === expectedUpdateState) &&
            reply.data
          );
        } catch (error) {
          latest = { error: error.message };
          return false;
        }
      },
      expectedUpdateState ? `ready service with updater ${expectedUpdateState}` : "ready service",
    );
  } catch (error) {
    throw new Error(`${error.message}; last health: ${JSON.stringify(latest)}`, { cause: error });
  }
}
