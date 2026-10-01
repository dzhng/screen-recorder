import assert from "node:assert/strict";
import { Session } from "node:inspector/promises";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

export const profileLimits = {
  armMs: 60000,
  overallMs: 180000,
  rssBytes: 1024 ** 3,
  sampleMs: 200,
  controlMs: 5000,
  shutdownMs: 15000,
};

/** Opt-in child-process sampling; no project, native worker or production instrumentation. */
export function installServiceProfiler({ directory, limits = profileLimits }) {
  let active;
  const completed = new Map(),
    attempted = new Set();
  const send = (message) => {
    if (process.connected) process.send(message, () => {});
  };
  async function stop(reason = "complete") {
    if (!active) return null;
    const current = active;
    if (current.stopping) return current.stopping;
    current.samples.push({
      elapsedMs: performance.now() - current.at,
      bytes: process.memoryUsage().rss,
    });
    if (reason === "complete" && current.samples.at(-1).bytes > limits.rssBytes)
      reason = "rss_limit";
    clearInterval(current.sampler);
    clearTimeout(current.deadline);
    current.stopping = (async () => {
      try {
        const { profile } = await current.session.post("Profiler.stop");
        const cpu = process.cpuUsage(current.cpu);
        const elapsedMs = performance.now() - current.at;
        const file = join(directory, `service-${current.arm}.cpuprofile`);
        await writeFile(file, JSON.stringify(profile), { flag: "wx" });
        const result = {
          arm: current.arm,
          pid: process.pid,
          reason,
          file,
          cpu,
          elapsedMs,
          rssSamples: current.samples,
          limits,
          attribution:
            "Instrumented service CPU delta includes inspector-control and RSS-sampler overhead; raw samples retain idle/GC/native attribution limits",
        };
        await writeFile(
          join(directory, `service-${current.arm}-profile.json`),
          JSON.stringify(result, null, 2),
          { flag: "wx" },
        );
        completed.set(current.arm, result);
        return result;
      } finally {
        current.session.disconnect();
        active = undefined;
      }
    })();
    return current.stopping;
  }
  const guard = (reason) => {
    void stop(reason).then(
      (profile) => send({ type: "cpu.guard", reason, profile }),
      (error) => send({ type: "cpu.guard", reason, error: error.message }),
    );
  };
  async function start(arm) {
    assert([512, 1024].includes(arm));
    assert(!active && !attempted.has(arm), "Only one CPU profile per arm is permitted");
    attempted.add(arm);
    const session = new Session();
    session.connect();
    try {
      await session.post("Profiler.enable");
      await session.post("Profiler.setSamplingInterval", { interval: 1000 });
      await session.post("Profiler.start");
    } catch (error) {
      session.disconnect();
      throw error;
    }
    active = { arm, session, at: performance.now(), cpu: process.cpuUsage(), samples: [] };
    const current = active;
    const sample = () => {
      const bytes = process.memoryUsage().rss;
      current.samples.push({ elapsedMs: performance.now() - current.at, bytes });
      if (bytes > limits.rssBytes) guard("rss_limit");
    };
    active.sampler = setInterval(sample, limits.sampleMs);
    active.deadline = setTimeout(() => guard("arm_deadline"), limits.armMs);
    sample();
    return { arm, pid: process.pid, limits };
  }
  // Match the existing job-inspection IPC convention: caller IDs correlate terminal replies.
  let commands = Promise.resolve();
  const receive = (message) => {
    if (!["cpu.start", "cpu.stop"].includes(message?.type)) return;
    commands = commands.then(async () => {
      try {
        if (message.type === "cpu.stop")
          assert(
            completed.has(message.arm) || active?.arm === message.arm,
            "No matching active CPU profile",
          );
        const result =
          message.type === "cpu.start"
            ? await start(message.arm)
            : (completed.get(message.arm) ?? (await stop(message.reason)));
        send({ id: message.id, type: message.type, result });
      } catch (error) {
        send({ id: message.id, type: message.type, error: error.message });
      }
    });
  };
  process.on("message", receive);
  return async () => {
    process.off("message", receive);
    await commands;
    await stop("service_closed");
  };
}
