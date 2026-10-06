import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { mediaWorker } from "../../../service/dist/worker.js";

/** Register the complete inspection with drain, or finish job teardown inside the callback. */
export async function withArchiveCopyBarrier(
  home,
  native,
  { partial = false, operation: selectedOperation = "archive.extract", minimumFd = 4 },
  inspect,
) {
  const marker = join(home, `copy-held-${randomUUID()}`);
  const library = `${marker}.dylib`;
  const run = mediaWorker({ YAP_NATIVE: native });
  const abort = new AbortController();
  const active = new Set();
  const track = (call) => {
    active.add(call);
    void call.finally(() => active.delete(call));
    return call;
  };
  const held = Promise.withResolvers();
  void held.promise.catch(() => {});
  let pending,
    completion,
    observing,
    pid,
    done = false,
    closed = false;
  try {
    execFileSync("/usr/bin/clang", [
      "-dynamiclib",
      "-o",
      library,
      fileURLToPath(new URL("./archive-copy-barrier.c", import.meta.url)),
    ]);
    const worker = (operation, params, options) => {
      assert.equal(closed, false, "Barrier worker cannot outlive its fixture callback");
      if (operation !== selectedOperation) return track(run(operation, params, options));
      assert.equal(pending, undefined, "Copy barrier admits one extraction");
      const environment = {
        DYLD_INSERT_LIBRARIES: library,
        YAP_TEST_COPY_BARRIER: marker,
        YAP_TEST_COPY_MIN_FD: String(minimumFd),
        YAP_TEST_COPY_PARTIAL: partial ? "1" : "0",
      };
      const previous = Object.fromEntries(
        Object.keys(environment).map((key) => [key, process.env[key]]),
      );
      Object.assign(process.env, environment);
      try {
        pending = track(
          run(operation, params, {
            ...options,
            timeoutMs: 5000,
            signal: options?.signal
              ? AbortSignal.any([options.signal, abort.signal])
              : abort.signal,
          }),
        );
      } finally {
        for (const [key, value] of Object.entries(previous)) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
      }
      void pending.then(() => {
        done = true;
      });
      observing = (async () => {
        while (!done) {
          const value = await readFile(marker, "utf8").catch((error) => {
            if (error.code === "ENOENT") return "";
            throw error;
          });
          if (value) {
            pid = Number(value);
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 1));
        }
        assert.ok(pid, "Native pread must reach the syscall barrier");
        assert.equal(
          execFileSync("/bin/ps", ["-p", String(pid), "-o", "ppid=,command="], {
            encoding: "utf8",
          }).trim(),
          `${process.pid} ${native}`,
        );
        while (
          !execFileSync("/bin/ps", ["-p", String(pid), "-o", "state="], { encoding: "utf8" })
            .trim()
            .startsWith("T")
        )
          await new Promise((resolve) => setTimeout(resolve, 1));
        return { pid };
      })().then(held.resolve, held.reject);
      return pending;
    };
    return await inspect({
      worker,
      held: held.promise,
      drain(inspection) {
        assert.equal(completion, undefined, "Copy barrier drains one inspection");
        completion = Promise.resolve(inspection);
        void completion.then(
          () => held.reject(new Error("Inspection finished before reaching the copy barrier")),
          held.reject,
        );
        return completion;
      },
      async resume() {
        await held.promise;
        if (!done) {
          try {
            process.kill(pid, "SIGCONT");
          } catch (error) {
            if (error.code !== "ESRCH") throw error;
          }
        }
        return await pending;
      },
    });
  } finally {
    abort.abort();
    await pending;
    await completion?.catch(() => {});
    await observing;
    while (active.size) await Promise.all(active);
    closed = true;
    if (pid)
      assert.throws(
        () => process.kill(pid, 0),
        (error) => error.code === "ESRCH",
      );
    await rm(marker, { force: true });
    await rm(library, { force: true });
  }
}
