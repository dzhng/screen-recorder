import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { afterEach, expect, test } from "vitest";
import { listenLocal } from "@yap/service";
import type { OperationRequest, OperationResult } from "@yap/protocol";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanups.splice(0).reverse()) await close();
});
async function fixture(
  handler: (request: OperationRequest) => OperationResult | Promise<OperationResult>,
) {
  const home = await mkdtemp("/tmp/yap-wait-");
  cleanups.push(() => rm(home, { recursive: true, force: true }));
  const calls: OperationRequest[] = [];
  const service = await listenLocal({
    runtimeDirectory: home,
    handler: (request) => {
      calls.push(request);
      return handler(request);
    },
  });
  cleanups.push(() => service.close());
  const run = (
    operation: string,
    params: Record<string, unknown>,
    args: string[] = [],
    cancelAfterMs?: number,
    nodeArgs: string[] = [],
  ) => {
    const child = spawn(
      process.execPath,
      [
        ...nodeArgs,
        new URL("../dist/main.js", import.meta.url).pathname,
        operation,
        "--socket",
        service.socketPath,
        "--params",
        JSON.stringify(params),
        "--id",
        "wait-case",
        ...args,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let cancel: ReturnType<typeof setTimeout> | undefined;
    child.once("exit", () => {
      if (cancel) clearTimeout(cancel);
    });
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (part) => {
      stdout += part;
    });
    child.stderr.on("data", (part) => {
      stderr += part;
      if (cancelAfterMs !== undefined && !cancel)
        cancel = setTimeout(() => child.kill("SIGINT"), cancelAfterMs);
    });
    return new Promise<{ code: number | null; stdout: string; stderr: string }>(
      (resolve, reject) => {
        child.once("error", reject);
        child.once("exit", (code) => resolve({ code, stdout, stderr }));
      },
    );
  };
  return { home, calls, run, stop: () => service.close() };
}
const job = (state: string, generation = 2) => ({
  jobId: "job",
  attemptId: `attempt-${generation}`,
  generation,
  state,
  target: { kind: "import", importId: "admission" },
  published: { generation: 1, attemptId: "older", output: { assetId: "old" } },
});

test("wait submits a mutation once and waits for its current generation instead of accepting retained output", async () => {
  let reads = 0;
  const f = await fixture((request) => {
    if (request.operation === "asset.import") return { ok: true, data: job("queued") };
    expect(request.operation).toBe("job.get");
    return {
      ok: true,
      data:
        ++reads === 1
          ? job("running")
          : {
              ...job("ready"),
              published: { generation: 2, attemptId: "attempt-2", output: { assetId: "new" } },
            },
    };
  });
  const output = await f.run(
    "asset.import",
    { path: "/fixture/source.mov", requestId: "admission" },
    ["--wait", "--timeout-ms", "1000"],
  );
  expect(output.code).toBe(0);
  expect(output.stdout.trim().split("\n")).toHaveLength(1);
  expect(JSON.parse(output.stdout)).toMatchObject({
    id: "wait-case",
    ok: true,
    data: { state: "ready", generation: 2, published: { output: { assetId: "new" } } },
  });
  expect(f.calls.map((request) => request.operation)).toEqual([
    "asset.import",
    "job.get",
    "job.get",
  ]);
  expect(output.stderr).toContain("running");
});

test("pending timeout preserves pinned acknowledgement and current generation, closes unused leases and creates no final file", async () => {
  const f = await fixture((request) => {
    if (request.operation === "frame.get")
      return {
        ok: true,
        data: {
          projectId: "p",
          revisionId: "r7",
          state: "processing",
          jobId: "job",
          published: { generation: 1, output: { mediaType: "image/png" } },
          delivery: { token: "old-pin", bytes: 1, expiresAt: Date.now() + 30000 },
        },
      };
    if (request.operation === "artifact.close") return { ok: true, data: { closed: true } };
    expect(request.operation).toBe("job.get");
    return {
      ok: true,
      data: { ...job("running"), target: { kind: "project", projectId: "p", revisionId: "r7" } },
    };
  });
  const destination = `${f.home}/must-not-exist.png`;
  const output = await f.run("frame.get", { projectId: "p", atUs: 7 }, [
    "--wait",
    "--timeout-ms",
    "80",
    "--output",
    destination,
  ]);
  expect(output.code).toBe(2);
  expect(JSON.parse(output.stdout)).toMatchObject({
    ok: true,
    data: { projectId: "p", revisionId: "r7", state: "processing", published: { generation: 1 } },
    wait: {
      state: "timed_out",
      timeoutMs: 80,
      job: { jobId: "job", generation: 2, attemptId: "attempt-2" },
    },
  });
  expect(f.calls.filter((request) => request.operation === "frame.get")).toHaveLength(1);
  expect(f.calls.some((request) => request.operation === "artifact.close")).toBe(true);
  const { stat } = await import("node:fs/promises");
  await expect(stat(destination)).rejects.toMatchObject({ code: "ENOENT" });
});

test("an older ready rendition never becomes the final file while its replacement is still running", async () => {
  const f = await fixture((request) => {
    if (request.operation === "frame.get")
      return {
        ok: true,
        data: {
          projectId: "p",
          revisionId: "r7",
          state: "ready",
          jobId: "job",
          published: { generation: 1, output: { mediaType: "image/png" } },
          delivery: { token: "old-pin", bytes: 1, expiresAt: Date.now() + 30000 },
        },
      };
    if (request.operation === "artifact.close") return { ok: true, data: { closed: true } };
    if (request.operation === "artifact.read")
      return { ok: true, data: { data: "eA==", offset: 0, nextOffset: 1, eof: true } };
    expect(request.operation).toBe("job.get");
    return {
      ok: true,
      data: { ...job("running"), target: { kind: "project", projectId: "p", revisionId: "r7" } },
    };
  });
  const destination = `${f.home}/not-the-replacement.png`;
  const output = await f.run("frame.get", { projectId: "p", atUs: 7 }, [
    "--wait",
    "--timeout-ms",
    "80",
    "--output",
    destination,
  ]);
  expect(JSON.parse(output.stdout)).toMatchObject({ ok: true, wait: { state: "timed_out" } });
  expect(output.code).toBe(2);
  expect(f.calls.some((request) => request.operation === "artifact.read")).toBe(false);
  const { stat } = await import("node:fs/promises");
  await expect(stat(destination)).rejects.toMatchObject({ code: "ENOENT" });
});

test("wait refuses a changed current job target and preserves the acknowledgement", async () => {
  let reads = 0;
  const f = await fixture((request) => {
    if (request.operation === "asset.import") return { ok: true, data: job("queued") };
    return {
      ok: true,
      data: {
        ...job("running"),
        target: { kind: "import", importId: ++reads === 1 ? "admission" : "other" },
      },
    };
  });
  const output = await f.run(
    "asset.import",
    { path: "/fixture/source.mov", requestId: "admission" },
    ["--wait", "--timeout-ms", "1000"],
  );
  expect(output.code).toBe(1);
  expect(JSON.parse(output.stdout)).toMatchObject({
    ok: true,
    data: { target: { importId: "admission" } },
    wait: { state: "interrupted", error: { code: "INVALID_RESPONSE" } },
  });
});

test("a prepared-audio dependency finishing does not finish the requested measurement", async () => {
  let reads = 0;
  const f = await fixture((request) => {
    if (request.operation === "audio.measure")
      return {
        ok: true,
        data: {
          assetId: "a",
          streamId: "s",
          state: "processing",
          jobId: ++reads === 1 ? "audio-job" : "measurement-job",
          published: null,
        },
      };
    if (request.operation === "job.get")
      return {
        ok: true,
        data: {
          ...job(request.params.jobId === "audio-job" ? "ready" : "failed"),
          jobId: request.params.jobId,
          target: { kind: "asset", assetId: "a" },
        },
      };
    throw new Error(`unexpected ${request.operation}`);
  });
  const output = await f.run("audio.measure", { assetId: "a", streamId: "s" }, [
    "--wait",
    "--timeout-ms",
    "1000",
  ]);
  expect(output.code).toBe(1);
  expect(JSON.parse(output.stdout)).toMatchObject({
    data: { jobId: "measurement-job", state: "failed" },
    wait: { state: "settled", job: { jobId: "measurement-job" } },
  });
  expect(f.calls.filter((r) => r.operation === "audio.measure").map((r) => r.params)).toEqual([
    { assetId: "a", streamId: "s" },
    { assetId: "a", streamId: "s" },
  ]);
});

test("model preparation waits through its advertised model.status getter without resubmitting source choices", async () => {
  const f = await fixture((request) => {
    if (request.operation === "model.prepare")
      return { ok: true, data: { modelId: "whisper-tiny", state: "preparing" } };
    expect(request.operation).toBe("model.status");
    return { ok: true, data: { modelId: "whisper-tiny", state: "ready" } };
  });
  const output = await f.run(
    "model.prepare",
    { modelId: "whisper-tiny", modelSource: "/fixture/model" },
    ["--wait", "--timeout-ms", "1000"],
  );
  expect(output.code).toBe(0);
  expect(JSON.parse(output.stdout)).toMatchObject({
    data: { state: "ready" },
    wait: { state: "settled" },
  });
  expect(f.calls.map((r) => r.params)).toEqual([
    { modelId: "whisper-tiny", modelSource: "/fixture/model" },
    { modelId: "whisper-tiny" },
  ]);
});

test("alignment preparation waits for its admitted job and reuses the same literal request", async () => {
  const params = {
    assetId: "a",
    streamId: "s",
    channel: 0,
    sourceRange: { startUs: 0, endUs: 1000000 },
    text: "Hi, literal text!",
    modelId: "nemo-ctc110",
  };
  let preparations = 0;
  const f = await fixture((request) => {
    if (request.operation === "job.get")
      return { ok: true, data: { ...job("ready"), target: { kind: "asset", assetId: "a" } } };
    expect(request.operation).toBe("alignment.prepare");
    expect(request.params).toEqual(params);
    return {
      ok: true,
      data:
        ++preparations === 1
          ? { state: "processing", jobId: "job" }
          : {
              state: "ready",
              published: {
                generation: 1,
                attemptId: "attempt",
                output: { generation: "attempt", source: { text: params.text } },
              },
            },
    };
  });
  const output = await f.run("alignment.prepare", params, ["--wait", "--timeout-ms", "1000"]);
  expect(output.code, output.stdout + output.stderr).toBe(0);
  expect(JSON.parse(output.stdout)).toMatchObject({
    data: { state: "ready", published: { output: { generation: "attempt" } } },
    wait: { state: "settled" },
  });
  expect(f.calls.map((r) => r.operation)).toEqual([
    "alignment.prepare",
    "job.get",
    "alignment.prepare",
  ]);
});

test("bounded transcript preparation waits for its admitted generation without resubmitting inference", async () => {
  const generation = "c6df7efc-a023-4c40-aa08-3b8b1c0b1b90";
  const selection = { assetId: "a", streamId: "s", acquisitionId: "acquired" };
  const f = await fixture((request) => {
    if (request.operation === "transcript.prepare")
      return { ok: true, data: { ...selection, state: "processing", jobId: "job" } };
    if (request.operation === "job.get")
      return {
        ok: true,
        data: {
          ...job("ready"),
          attemptId: generation,
          target: { kind: "asset", assetId: "a" },
        },
      };
    expect(request.operation).toBe("transcript.get");
    return { ok: true, data: { ...selection, state: "ready", generation, page: { rows: [] } } };
  });
  const output = await f.run(
    "transcript.prepare",
    {
      ...selection,
      executionRange: { startUs: 0, endUs: 1000000 },
      context: { beforeUs: 10, afterUs: 20 },
    },
    ["--wait", "--timeout-ms", "1000"],
  );
  expect(output.code, output.stdout + output.stderr).toBe(0);
  expect(JSON.parse(output.stdout)).toMatchObject({
    data: { state: "ready", generation },
    wait: { state: "settled", job: { attemptId: generation } },
  });
  expect(f.calls.map((r) => r.operation)).toEqual([
    "transcript.prepare",
    "job.get",
    "transcript.get",
  ]);
  expect(f.calls[2]!.params).toEqual({ ...selection, generation });
});

test("rendered recognition waits on the project attempt with its complete pinned selection", async () => {
  const params = {
    projectId: "p",
    revisionId: "r",
    range: { startUs: 1000000, endUs: 2000000 },
    tap: { target: { kind: "output" }, point: { kind: "processed" } },
    rendition: { sampleRate: 16000, channels: 1 },
  };
  const generation = "c6df7efc-a023-4c40-aa08-3b8b1c0b1b90";
  let preparations = 0;
  const f = await fixture((request) => {
    if (request.operation === "job.get")
      return {
        ok: true,
        data: {
          ...job("ready"),
          attemptId: generation,
          target: { kind: "project", projectId: "p", revisionId: "r" },
        },
      };
    expect(request.operation).toBe("transcript.render.prepare");
    expect(request.params).toEqual(params);
    return {
      ok: true,
      data: {
        ...params,
        state: ++preparations === 1 ? "queued" : "ready",
        jobId: "job",
        published:
          preparations === 1
            ? null
            : {
                generation: 2,
                attemptId: generation,
                output: { kind: "rendered-speech", generation, pcm: { assetId: "measured" } },
              },
      },
    };
  });
  const output = await f.run("transcript.render.prepare", params, [
    "--wait",
    "--timeout-ms",
    "1000",
  ]);
  expect(output.code, output.stdout + output.stderr).toBe(0);
  expect(JSON.parse(output.stdout)).toMatchObject({
    data: { state: "ready", published: { output: { generation } } },
    wait: { state: "settled", job: { attemptId: generation } },
  });
  expect(f.calls.filter((call) => call.operation === "transcript.render.prepare")).toHaveLength(2);
});

test.each(["package.open", "package.status"])(
  "%s observes the process-local admission through package.status",
  async (operation) => {
    let admissions = 0;
    const f = await fixture((request) => {
      if (request.operation === "job.get")
        return {
          ok: false,
          error: {
            code: "NOT_FOUND",
            message: "Context job is not public",
            retryable: false,
            details: {},
          },
        };
      if (request.operation === operation && admissions++ === 0)
        return {
          ok: true,
          data: {
            id: "admission",
            state: "queued",
            jobId: "opaque-context-job",
            packageHandle: null,
            error: null,
          },
        };
      expect(request.operation).toBe("package.status");
      expect(request.params).toEqual({ admissionId: "admission" });
      return {
        ok: true,
        data: {
          id: "admission",
          state: "ready",
          jobId: "opaque-context-job",
          packageHandle: "process-local-handle",
          error: null,
        },
      };
    });
    const output = await f.run(
      operation,
      operation === "package.open"
        ? { path: "/fixture/project.zip" }
        : { admissionId: "admission" },
      ["--wait", "--timeout-ms", "1000"],
    );
    expect(output.code).toBe(0);
    const reply = JSON.parse(output.stdout);
    expect(reply).toMatchObject({
      data: { id: "admission", state: "ready", packageHandle: "process-local-handle" },
      wait: { state: "settled" },
    });
    expect(reply.wait).not.toHaveProperty("job");
    expect(f.calls.map((r) => r.operation)).toEqual([operation, "package.status"]);
  },
);

test("a lost process-local package admission preserves its acknowledgement without claiming rollback", async () => {
  const f = await fixture((request) =>
    request.operation === "package.open"
      ? {
          ok: true,
          data: {
            id: "admission",
            state: "opening",
            jobId: "opaque-context-job",
            packageHandle: null,
            error: null,
          },
        }
      : {
          ok: false,
          error: {
            code: "NOT_FOUND",
            message: "Package admission expired or does not exist",
            retryable: false,
            details: {},
          },
        },
  );
  const output = await f.run("package.open", { path: "/fixture/project.zip" }, [
    "--wait",
    "--timeout-ms",
    "1000",
  ]);
  expect(output.code).toBe(1);
  const reply = JSON.parse(output.stdout);
  expect(reply).toMatchObject({
    ok: true,
    data: { id: "admission", state: "opening", packageHandle: null },
    wait: { state: "interrupted", error: { code: "NOT_FOUND" } },
  });
  expect(reply.wait).not.toHaveProperty("job");
  expect(f.calls.map((r) => r.operation)).toEqual(["package.open", "package.status"]);
});

test.each(["deadline", "foreign"])(
  "package admission %s preserves the admitted identity",
  async (mode) => {
    const admission = {
      id: "admission",
      state: "opening",
      jobId: "opaque-context-job",
      packageHandle: null,
      error: null,
    };
    const f = await fixture((request) => ({
      ok: true,
      data:
        request.operation === "package.status" && mode === "foreign"
          ? { ...admission, id: "foreign", state: "ready", packageHandle: "foreign-handle" }
          : admission,
    }));
    const output = await f.run("package.open", { path: "/fixture/project.zip" }, [
      "--wait",
      "--timeout-ms",
      mode === "deadline" ? "240" : "1000",
    ]);
    expect(output.code).toBe(mode === "deadline" ? 2 : 1);
    const reply = JSON.parse(output.stdout);
    expect(reply).toMatchObject({
      data: admission,
      wait: { state: mode === "deadline" ? "timed_out" : "interrupted" },
    });
    if (mode === "foreign") expect(reply.wait.error.code).toBe("INVALID_RESPONSE");
    expect(reply.wait).not.toHaveProperty("job");
    expect(f.calls.filter((r) => r.operation === "package.open")).toHaveLength(1);
    expect(f.calls.filter((r) => r.operation === "package.status").length).toBeGreaterThan(0);
    expect(f.calls.filter((r) => r.operation === "job.get")).toEqual([]);
  },
);

test("package closing remains pending until its process-local owner settles", async () => {
  let reads = 0;
  const f = await fixture(() => ({
    ok: true,
    data: {
      id: "admission",
      state: reads++ === 0 ? "closing" : "closed",
      jobId: "opaque-context-job",
      packageHandle: null,
      error: null,
    },
  }));
  const output = await f.run("package.status", { admissionId: "admission" }, [
    "--wait",
    "--timeout-ms",
    "1000",
  ]);
  expect(output.code).toBe(1);
  expect(JSON.parse(output.stdout)).toMatchObject({
    data: { id: "admission", state: "closed" },
    wait: { state: "settled" },
  });
  expect(f.calls.map((r) => r.operation)).toEqual(["package.status", "package.status"]);
});

test("batch wait inspects replacement jobs before accepting retained ready items", async () => {
  const f = await fixture((request) => {
    if (request.operation === "frame.batch")
      return {
        ok: true,
        data: {
          projectId: "p",
          revisionId: "r7",
          items: [
            {
              atUs: 7,
              ok: true,
              data: {
                state: "ready",
                jobId: "job",
                published: { generation: 1, output: { mediaType: "image/png" } },
                delivery: { token: "old", bytes: 1, expiresAt: Date.now() + 30000 },
              },
            },
            {
              atUs: 9,
              ok: false,
              error: {
                code: "OUT_OF_RANGE",
                message: "unsupported",
                retryable: false,
                details: {},
              },
            },
          ],
        },
      };
    if (request.operation === "artifact.close") return { ok: true, data: { closed: true } };
    expect(request.operation).toBe("job.get");
    return {
      ok: true,
      data: { ...job("running"), target: { kind: "project", projectId: "p", revisionId: "r7" } },
    };
  });
  const output = await f.run("frame.batch", { projectId: "p", atUs: [7, 9] }, [
    "--wait",
    "--timeout-ms",
    "80",
    "--output",
    `${f.home}/no-batch`,
  ]);
  expect(output.code).toBe(2);
  expect(JSON.parse(output.stdout)).toMatchObject({
    data: {
      revisionId: "r7",
      items: [{ ok: true }, { ok: false, error: { code: "OUT_OF_RANGE" } }],
    },
    wait: { state: "timed_out" },
  });
  expect(f.calls.some((r) => r.operation === "artifact.read")).toBe(false);
});

test("a changed pinned revision interrupts waiting without delivering another revision", async () => {
  let reads = 0;
  const f = await fixture((request) => {
    if (request.operation === "frame.get")
      return {
        ok: true,
        data: {
          projectId: "p",
          revisionId: ++reads === 1 ? "r7" : "r8",
          state: reads === 1 ? "processing" : "ready",
          jobId: "job",
          published: null,
          delivery:
            reads === 1
              ? null
              : { token: "foreign-revision", bytes: 1, expiresAt: Date.now() + 30000 },
        },
      };
    if (request.operation === "artifact.close") return { ok: true, data: { closed: true } };
    return {
      ok: true,
      data: { ...job("ready"), target: { kind: "project", projectId: "p", revisionId: "r7" } },
    };
  });
  const output = await f.run("frame.get", { projectId: "p", atUs: 7 }, [
    "--wait",
    "--timeout-ms",
    "1000",
  ]);
  expect(output.code).toBe(1);
  expect(JSON.parse(output.stdout)).toMatchObject({
    data: { revisionId: "r7", state: "processing" },
    wait: { state: "interrupted", error: { code: "INVALID_RESPONSE" } },
  });
  expect(
    f.calls.filter((r) => r.operation === "frame.get").map((r) => r.params.revisionId),
  ).toEqual([undefined, "r7"]);
  expect(
    f.calls.filter((r) => r.operation === "artifact.close").map((r) => r.params.token),
  ).toContain("foreign-revision");
});

test("a hung inspection respects the total wait deadline and preserves admitted work", async () => {
  const f = await fixture(async (request) => {
    if (request.operation === "asset.import") return { ok: true, data: job("queued") };
    await new Promise((resolve) => setTimeout(resolve, 160));
    return { ok: true, data: job("running") };
  });
  const output = await f.run(
    "asset.import",
    { requestId: "admission", path: "/fixture/source.mov" },
    ["--wait", "--timeout-ms", "80"],
  );
  expect(output.code).toBe(2);
  expect(JSON.parse(output.stdout)).toMatchObject({
    data: { state: "queued", jobId: "job" },
    wait: { state: "timed_out" },
  });
  expect(f.calls.filter((r) => r.operation === "asset.import")).toHaveLength(1);
});

test("SIGINT preserves the acknowledged selection and closes leases after cancellation", async () => {
  const f = await fixture(async (request) => {
    if (request.operation === "frame.get")
      return {
        ok: true,
        data: {
          projectId: "p",
          revisionId: "r7",
          state: "processing",
          jobId: "job",
          published: null,
          delivery: { token: "unused", bytes: 1, expiresAt: Date.now() + 30000 },
        },
      };
    if (request.operation === "artifact.close") return { ok: true, data: { closed: true } };
    await new Promise((resolve) => setTimeout(resolve, 220));
    return { ok: true, data: job("running") };
  });
  const output = await f.run(
    "frame.get",
    { projectId: "p", atUs: 7 },
    ["--wait", "--timeout-ms", "1000"],
    150,
  );
  expect(output.code).toBe(1);
  expect(JSON.parse(output.stdout)).toMatchObject({
    data: { revisionId: "r7", jobId: "job" },
    wait: { state: "interrupted", error: { code: "ABORTED" } },
  });
  expect(
    f.calls.filter((r) => r.operation === "artifact.close").map((r) => r.params.token),
  ).toContain("unused");
});

test("admission timeout reports uncertainty without claiming a mutation was rolled back", async () => {
  const f = await fixture(async () => {
    await new Promise((resolve) => setTimeout(resolve, 160));
    return { ok: true, data: job("queued") };
  });
  const output = await f.run(
    "asset.import",
    { requestId: "admission", path: "/fixture/source.mov" },
    ["--wait", "--timeout-ms", "80"],
  );
  expect(output.code).toBe(2);
  expect(JSON.parse(output.stdout)).toMatchObject({
    ok: false,
    error: { code: "ABORTED" },
    wait: { state: "timed_out", timeoutMs: 80 },
  });
  expect(f.calls.map((r) => r.operation)).toEqual(["asset.import"]);
});

test("a service disappearing after admission interrupts waiting with durable identity", async () => {
  const f = await fixture(async (request) => {
    if (request.operation === "asset.import") return { ok: true, data: job("queued") };
    void f.stop();
    await new Promise((resolve) => setTimeout(resolve, 120));
    return { ok: true, data: job("running") };
  });
  const output = await f.run(
    "asset.import",
    { requestId: "admission", path: "/fixture/source.mov" },
    ["--wait", "--timeout-ms", "1000"],
  );
  expect(output.code).toBe(1);
  expect(JSON.parse(output.stdout)).toMatchObject({
    ok: true,
    data: { jobId: "job", target: { importId: "admission" } },
    wait: {
      state: "interrupted",
      error: { code: expect.stringMatching(/^(CONNECTION_|INVALID_RESPONSE)/) },
    },
  });
  expect(f.calls.filter((r) => r.operation === "asset.import")).toHaveLength(1);
});

test("the wait deadline covers media delivery and never publishes an incomplete destination", async () => {
  const f = await fixture(async (request) => {
    if (request.operation === "audio.measure")
      return {
        ok: true,
        data: {
          assetId: "a",
          streamId: "s",
          state: "ready",
          published: { generation: 1, output: { mediaType: "application/json" } },
          delivery: { token: "measurement", bytes: 2, expiresAt: Date.now() + 30000 },
        },
      };
    if (request.operation === "artifact.close") return { ok: true, data: { closed: true } };
    expect(request.operation).toBe("artifact.read");
    await new Promise((resolve) => setTimeout(resolve, 180));
    return {
      ok: true,
      data: { offset: 0, nextOffset: 2, eof: true, data: Buffer.from("{}").toString("base64") },
    };
  });
  const destination = `${f.home}/measurement.json`;
  const output = await f.run("audio.measure", { assetId: "a", streamId: "s" }, [
    "--wait",
    "--timeout-ms",
    "80",
    "--output",
    destination,
  ]);
  expect(output.code).toBe(2);
  expect(JSON.parse(output.stdout)).toMatchObject({
    ok: true,
    data: { assetId: "a", state: "ready" },
    wait: { state: "timed_out" },
  });
  const { stat, readdir } = await import("node:fs/promises");
  await expect(stat(destination)).rejects.toMatchObject({ code: "ENOENT" });
  expect((await readdir(f.home)).filter((name) => name.startsWith(".yap-media-"))).toEqual([]);
  expect(f.calls.some((r) => r.operation === "artifact.close")).toBe(true);
});

test("wait budget validation happens before discovery while ordinary acknowledgements stay unchanged", async () => {
  const f = await fixture(() => ({ ok: true, data: job("queued") }));
  for (const args of [
    ["--wait"],
    ["--timeout-ms", "80"],
    ["--wait", "--timeout-ms", "0"],
    ["--wait", "--timeout-ms", "1.5"],
    ["--wait", "--timeout-ms", "2147483648"],
  ]) {
    const output = await f.run(
      "asset.import",
      { requestId: "admission", path: "/fixture/source.mov" },
      args,
    );
    expect(output.code).toBe(1);
    expect(JSON.parse(output.stdout)).toMatchObject({
      ok: false,
      error: { code: "INVALID_REQUEST" },
    });
  }
  expect(f.calls).toEqual([]);
  const ordinary = await f.run("asset.import", {
    requestId: "admission",
    path: "/fixture/source.mov",
  });
  expect(ordinary.code).toBe(0);
  expect(JSON.parse(ordinary.stdout)).toEqual({ id: "wait-case", ok: true, data: job("queued") });
  expect(f.calls.map((r) => r.operation)).toEqual(["asset.import"]);
});

test("a delayed batch delivers only completed items and retains each terminal failure", async () => {
  let reads = 0;
  const f = await fixture((request) => {
    if (request.operation === "frame.batch") {
      const ready = ++reads > 1;
      return {
        ok: true,
        data: {
          projectId: "p",
          revisionId: "r7",
          items: [
            {
              atUs: 7,
              ok: true,
              data: {
                state: ready ? "ready" : "processing",
                jobId: "ready-job",
                published: ready ? { generation: 2, output: { mediaType: "image/png" } } : null,
                delivery: ready
                  ? { token: "complete", bytes: 2, expiresAt: Date.now() + 30000 }
                  : null,
              },
            },
            {
              atUs: 9,
              ok: false,
              error: {
                code: "OUT_OF_RANGE",
                message: "unsupported",
                retryable: false,
                details: {},
              },
            },
          ],
        },
      };
    }
    if (request.operation === "job.get")
      return {
        ok: true,
        data: {
          ...job("ready"),
          jobId: "ready-job",
          target: { kind: "project", projectId: "p", revisionId: "r7" },
        },
      };
    if (request.operation === "artifact.close") return { ok: true, data: { closed: true } };
    expect(request.operation).toBe("artifact.read");
    return {
      ok: true,
      data: { offset: 0, nextOffset: 2, eof: true, data: Buffer.from("ok").toString("base64") },
    };
  });
  const directory = `${f.home}/completed-batch`;
  const output = await f.run("frame.batch", { projectId: "p", atUs: [7, 9] }, [
    "--wait",
    "--timeout-ms",
    "1000",
    "--output",
    directory,
  ]);
  expect(output.code).toBe(1);
  expect(JSON.parse(output.stdout)).toMatchObject({
    data: {
      items: [
        { atUs: 7, ok: true, data: { output: `${directory}/01.png` } },
        { atUs: 9, ok: false, error: { code: "OUT_OF_RANGE" } },
      ],
    },
    wait: { state: "settled" },
  });
  const { readdir, readFile } = await import("node:fs/promises");
  expect(await readdir(directory)).toEqual(["01.png"]);
  expect(await readFile(`${directory}/01.png`, "utf8")).toBe("ok");
  expect(f.calls.filter((r) => r.operation.endsWith("retry"))).toEqual([]);
});

test("batch file publication drains a failed disk write without exposing a partial final file", async () => {
  const f = await fixture((request) => {
    if (request.operation === "frame.batch")
      return {
        ok: true,
        data: {
          assetId: "a",
          streamId: "s",
          items: [7, 9].map((atUs) => ({
            atUs,
            ok: true,
            data: {
              state: "ready",
              published: { generation: 1, output: { mediaType: "image/png" } },
              delivery: { token: `frame-${atUs}`, bytes: 4, expiresAt: Date.now() + 30000 },
            },
          })),
        },
      };
    if (request.operation === "artifact.close") return { ok: true, data: { closed: true } };
    expect(request.operation).toBe("artifact.read");
    return {
      ok: true,
      data: { offset: 0, nextOffset: 4, eof: true, data: Buffer.from("full").toString("base64") },
    };
  });
  const preload = `${f.home}/disk-failure.mjs`;
  // The spawned consumer uses real files; only the external filesystem failure is controlled.
  await writeFile(
    preload,
    `
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
const probe = await fs.open(${JSON.stringify(`${f.home}/probe`)}, 'wx');
const prototype = Object.getPrototypeOf(probe);
await probe.close();
await fs.rm(${JSON.stringify(`${f.home}/probe`)});
let fail = true;
const directWrite = fs.writeFile;
const handleWrite = prototype.writeFile;
fs.writeFile = async function(path, data, options) {
  if (!fail) return directWrite(path, data, options);
  fail = false;
  await directWrite(path, data.subarray(0, 1), options);
  throw Object.assign(new Error('fixture ENOSPC'), { code: 'ENOSPC' });
};
prototype.writeFile = async function(data, options) {
  if (!fail) return handleWrite.call(this, data, options);
  fail = false;
  await handleWrite.call(this, data.subarray(0, 1), options);
  throw Object.assign(new Error('fixture ENOSPC'), { code: 'ENOSPC' });
};
syncBuiltinESMExports();
`,
  );
  const directory = `${f.home}/disk-batch`;
  const output = await f.run(
    "frame.batch",
    { assetId: "a", streamId: "s", atUs: [7, 9] },
    ["--wait", "--timeout-ms", "1000", "--output", directory],
    undefined,
    ["--import", preload],
  );
  expect(output.code).toBe(1);
  expect(JSON.parse(output.stdout)).toMatchObject({
    data: {
      items: [
        { atUs: 7, ok: false, error: { message: "fixture ENOSPC" } },
        { atUs: 9, ok: true, data: { output: `${directory}/02.png` } },
      ],
    },
    wait: { state: "settled" },
  });
  const { readdir, readFile } = await import("node:fs/promises");
  expect(await readdir(directory)).toEqual(["02.png"]);
  expect(await readFile(`${directory}/02.png`, "utf8")).toBe("full");
  expect(
    f.calls.filter((r) => r.operation === "artifact.close").map((r) => r.params.token),
  ).toEqual(["frame-7", "frame-9"]);
});

test("cached failed batch jobs drain every fresh retained lease while another item is pending", async () => {
  let reads = 0;
  const f = await fixture((request) => {
    if (request.operation === "frame.batch") {
      ++reads;
      return {
        ok: true,
        data: {
          projectId: "p",
          revisionId: "r7",
          items: [7, 9].map((atUs) => ({
            atUs,
            ok: true,
            data: {
              state: atUs === 7 || reads >= 3 ? "ready" : "processing",
              jobId: atUs === 7 ? "failed-job" : "ready-job",
              published:
                atUs === 7 || reads >= 3
                  ? { generation: atUs === 7 ? 1 : 2, output: { mediaType: "image/png" } }
                  : null,
              delivery:
                atUs === 7 || reads >= 3
                  ? {
                      token: atUs === 7 ? `failed-${reads}` : "complete",
                      bytes: 2,
                      expiresAt: Date.now() + 30000,
                    }
                  : null,
            },
          })),
        },
      };
    }
    if (request.operation === "job.get")
      return {
        ok: true,
        data: {
          ...job(
            request.params.jobId === "failed-job" ? "failed" : reads >= 3 ? "ready" : "processing",
          ),
          jobId: request.params.jobId,
          target: { kind: "project", projectId: "p", revisionId: "r7" },
        },
      };
    if (request.operation === "artifact.close") return { ok: true, data: { closed: true } };
    expect(request.operation).toBe("artifact.read");
    expect(request.params.token).toBe("complete");
    return {
      ok: true,
      data: { offset: 0, nextOffset: 2, eof: true, data: Buffer.from("ok").toString("base64") },
    };
  });
  const directory = `${f.home}/failed-batch`;
  const output = await f.run("frame.batch", { projectId: "p", atUs: [7, 9] }, [
    "--wait",
    "--timeout-ms",
    "1500",
    "--output",
    directory,
  ]);
  expect(output.code).toBe(1);
  expect(JSON.parse(output.stdout)).toMatchObject({
    data: {
      items: [
        { atUs: 7, ok: true, data: { state: "failed", jobId: "failed-job" } },
        { atUs: 9, ok: true, data: { output: `${directory}/02.png` } },
      ],
    },
    wait: { state: "settled" },
  });
  expect(
    f.calls.filter((r) => r.operation === "artifact.close").map((r) => r.params.token),
  ).toEqual(["failed-1", "failed-2", "failed-3", "complete"]);
  const { readdir } = await import("node:fs/promises");
  expect(await readdir(directory)).toEqual(["02.png"]);
});

test("a job for a different selected source cannot settle an acknowledged evidence read", async () => {
  const f = await fixture((request) =>
    request.operation === "audio.measure"
      ? {
          ok: true,
          data: { assetId: "a", streamId: "s", state: "processing", jobId: "job", published: null },
        }
      : { ok: true, data: { ...job("ready"), target: { kind: "asset", assetId: "different" } } },
  );
  const output = await f.run("audio.measure", { assetId: "a", streamId: "s" }, [
    "--wait",
    "--timeout-ms",
    "350",
  ]);
  expect(output.code).toBe(1);
  expect(JSON.parse(output.stdout)).toMatchObject({
    data: { assetId: "a", state: "processing" },
    wait: { state: "interrupted", error: { code: "INVALID_RESPONSE" } },
  });
});

test.each(["failed", "canceled"])(
  "a %s current replacement never delivers its older retained publication or retries it",
  async (state) => {
    const f = await fixture((request) => {
      if (request.operation === "frame.get")
        return {
          ok: true,
          data: {
            projectId: "p",
            revisionId: "r7",
            state: "ready",
            jobId: "job",
            published: { generation: 1, output: { mediaType: "image/png" } },
            delivery: { token: "old", bytes: 1, expiresAt: Date.now() + 30000 },
          },
        };
      if (request.operation === "artifact.close") return { ok: true, data: { closed: true } };
      expect(request.operation).toBe("job.get");
      return {
        ok: true,
        data: { ...job(state), target: { kind: "project", projectId: "p", revisionId: "r7" } },
      };
    });
    const output = await f.run("frame.get", { projectId: "p", atUs: 7 }, [
      "--wait",
      "--timeout-ms",
      "1000",
      "--output",
      `${f.home}/not-ready.png`,
    ]);
    expect(output.code).toBe(1);
    expect(JSON.parse(output.stdout)).toMatchObject({
      data: { state, generation: 2, published: { generation: 1 } },
      wait: { state: "settled", job: { generation: 2 } },
    });
    expect(
      f.calls.filter((r) => r.operation.endsWith("retry") || r.operation === "artifact.read"),
    ).toEqual([]);
  },
);

test("retry phrase waits through transcript.search while preserving the search query", async () => {
  const f = await fixture((request) => {
    if (request.operation === "transcript.retry")
      return { ok: true, data: { projectId: "p", state: "processing", jobId: "job" } };
    if (request.operation === "job.get")
      return { ok: true, data: { ...job("ready"), target: { kind: "project", projectId: "p" } } };
    expect(request.operation).toBe("transcript.search");
    return {
      ok: true,
      data: { projectId: "p", state: "ready", page: { entries: [], nextCursor: null } },
    };
  });
  const output = await f.run("transcript.retry", { projectId: "p", text: "spicy" }, [
    "--wait",
    "--timeout-ms",
    "1000",
  ]);
  expect(output.code).toBe(0);
  expect(f.calls.map((r) => r.operation)).toEqual([
    "transcript.retry",
    "job.get",
    "transcript.search",
  ]);
  expect(f.calls.at(-1)?.params).toMatchObject({ projectId: "p", text: "spicy" });
});

test.each(
  ["index.get", "transcript.get", "transcript.search"].flatMap((operation) =>
    [
      { initialReady: true, generation: "attempt-2", code: 0 },
      { initialReady: false, generation: "attempt-2", code: 0 },
      { initialReady: false, generation: "another-attempt", code: 1 },
    ].map((scenario) => ({ ...scenario, operation })),
  ),
)(
  "$operation pins completed page identity without unsupported parameters: $initialReady / $generation",
  async ({ initialReady, generation, code, operation }) => {
    let reads = 0;
    const ready = {
      assetId: "a",
      streamId: "s",
      state: "ready",
      generation,
      page:
        operation === "index.get"
          ? { metadata: { generation }, entries: [], nextCursor: null }
          : { transcript: { generation }, rows: [], matches: [], nextCursor: null },
    };
    const f = await fixture((request) => {
      if (request.operation === operation)
        return {
          ok: true,
          data:
            reads++ === 0 && !initialReady
              ? {
                  assetId: "a",
                  streamId: "s",
                  state: "processing",
                  jobId: "job",
                  published: null,
                }
              : ready,
        };
      if (request.operation === "job.get")
        return { ok: true, data: { ...job("ready"), target: { kind: "asset", assetId: "a" } } };
      throw new Error(request.operation);
    });
    const params = {
      assetId: "a",
      streamId: "s",
      ...(operation === "transcript.search" ? { text: "word" } : {}),
    };
    const output = await f.run(operation, params, ["--wait", "--timeout-ms", "1000"]);
    expect(output.code).toBe(code);
    const reply = JSON.parse(output.stdout);
    if (code === 1)
      expect(reply).toMatchObject({
        data: { assetId: "a", state: "processing", jobId: "job" },
        wait: {
          state: "interrupted",
          job: { jobId: "job", generation: 2, attemptId: "attempt-2" },
          error: { code: "INVALID_RESPONSE" },
        },
      });
    else {
      expect(reply).toMatchObject({ data: ready, wait: { state: "settled" } });
      if (!initialReady)
        expect(reply.wait.job).toEqual({ jobId: "job", generation: 2, attemptId: "attempt-2" });
    }
    expect(f.calls.filter((r) => r.operation === operation).at(-1)?.params).not.toHaveProperty(
      "generation",
    );
  },
);

test.each(["export.create", "export.status", "export.retry", "export.recover"])(
  "%s waits for export.status and returns the committed receipt",
  async (operation) => {
    let admissions = 0;
    const f = await fixture((request) => {
      if (request.operation === operation && admissions++ === 0)
        return {
          ok: true,
          data: { exportId: "550e8400-e29b-41d4-a716-446655440000", state: "queued", jobId: "job" },
        };
      if (request.operation === "job.get")
        return { ok: true, data: { ...job("ready"), target: { kind: "project", projectId: "p" } } };
      expect(request.operation).toBe("export.status");
      return {
        ok: true,
        data: {
          exportId: "550e8400-e29b-41d4-a716-446655440000",
          state: "committed",
          output: "/tmp/final.mp4",
        },
      };
    });
    const output = await f.run(
      operation,
      operation === "export.create"
        ? {
            exportId: "550e8400-e29b-41d4-a716-446655440000",
            projectId: "p",
            kind: "video",
            directory: "/tmp",
            leaf: "final.mp4",
          }
        : { exportId: "550e8400-e29b-41d4-a716-446655440000" },
      ["--wait", "--timeout-ms", "1000"],
    );
    expect(output.code).toBe(0);
    expect(JSON.parse(output.stdout)).toMatchObject({
      data: { state: "committed", output: "/tmp/final.mp4" },
      wait: { state: "settled" },
    });
  },
);

test.each(["export.recover", "export.retry", "export.status"])(
  "%s waits for nested recovery instead of the failed publication job",
  async (operation) => {
    let admissions = 0,
      polls = 0;
    const exportId = "550e8400-e29b-41d4-a716-446655440000";
    const base = {
      exportId,
      projectId: "p",
      jobId: "publication-job",
      snapshot: { revisionId: "r5" },
      destination: { directory: "/tmp", leaf: "final.mp4" },
    };
    const receipt = { leaf: "final.mp4", bytes: 2, sha256: "a".repeat(64) };
    const f = await fixture((request) => {
      if (request.operation === operation && admissions++ === 0)
        return {
          ok: true,
          data: {
            ...base,
            state: "failed",
            cleanupPending: true,
            receipt: null,
            output: null,
            recovery: { jobId: "recovery-job", state: "queued", published: null },
          },
        };
      if (request.operation === "job.get")
        return {
          ok: true,
          data: {
            ...job(
              request.params.jobId === "publication-job"
                ? "failed"
                : ++polls === 1
                  ? "processing"
                  : "ready",
            ),
            jobId: request.params.jobId,
            target: { kind: "project", projectId: "p", revisionId: "r5" },
          },
        };
      expect(request.operation).toBe("export.status");
      expect(request.params).toEqual({ exportId });
      return {
        ok: true,
        data: {
          ...base,
          state: "committed",
          cleanupPending: false,
          receipt,
          output: "/tmp/final.mp4",
          recovery: { jobId: "recovery-job", state: "ready", published: { generation: 2 } },
        },
      };
    });
    const output = await f.run(operation, { exportId }, ["--wait", "--timeout-ms", "1500"]);
    expect(output.code).toBe(0);
    expect(JSON.parse(output.stdout)).toMatchObject({
      data: { ...base, state: "committed", receipt, output: "/tmp/final.mp4" },
      wait: {
        state: "settled",
        job: { jobId: "recovery-job", generation: 2, attemptId: "attempt-2" },
      },
    });
    expect(f.calls.filter((r) => r.operation === "job.get").map((r) => r.params.jobId)).toEqual([
      "recovery-job",
      "recovery-job",
      "recovery-job",
    ]);
    expect(f.calls.filter((r) => r.operation === "export.status").at(-1)?.params).toEqual({
      exportId,
    });
    if (operation !== "export.status")
      expect(f.calls.filter((r) => r.operation === operation)).toHaveLength(1);
  },
);

test.each([
  { state: "failed", exposedState: "failed" },
  { state: "canceled", exposedState: "not_requested" },
])(
  "terminal $state recovery / $exposedState status preserves export history and exits unsuccessfully",
  async ({ state, exposedState }) => {
    const exportId = "550e8400-e29b-41d4-a716-446655440000";
    const receipt = { leaf: "final.mp4", bytes: 2, sha256: "a".repeat(64) };
    const base = {
      exportId,
      projectId: "p",
      jobId: "publication-job",
      state: "committed",
      cleanupPending: true,
      receipt,
      output: "/tmp/final.mp4",
      destination: { directory: "/tmp", leaf: "final.mp4" },
    };
    const f = await fixture((request) => {
      if (request.operation === "export.recover")
        return {
          ok: true,
          data: { ...base, recovery: { jobId: "recovery-job", state: "queued", published: null } },
        };
      if (request.operation === "job.get")
        return {
          ok: true,
          data: {
            ...job(state),
            jobId: "recovery-job",
            target: { kind: "project", projectId: "p", revisionId: "r5" },
          },
        };
      expect(request.operation).toBe("export.status");
      return {
        ok: true,
        data: {
          ...base,
          recovery: { jobId: "recovery-job", state: exposedState, published: null },
        },
      };
    });
    const output = await f.run("export.recover", { exportId }, ["--wait", "--timeout-ms", "1000"]);
    expect(output.code).toBe(1);
    expect(JSON.parse(output.stdout)).toMatchObject({
      data: { ...base, recovery: { jobId: "recovery-job", state: exposedState, published: null } },
      wait: {
        state: "settled",
        job: { jobId: "recovery-job", generation: 2, attemptId: "attempt-2" },
      },
    });
    expect(f.calls.map((r) => r.operation)).toEqual([
      "export.recover",
      "job.get",
      "export.status",
      "job.get",
    ]);
    expect(f.calls.filter((r) => r.operation === "job.get").map((r) => r.params.jobId)).toEqual([
      "recovery-job",
      "recovery-job",
    ]);
  },
);

test("terminal export getter refresh still refuses a concurrent recovery retry", async () => {
  const exportId = "550e8400-e29b-41d4-a716-446655440000";
  let inspections = 0;
  const base = {
    exportId,
    projectId: "p",
    jobId: "publication-job",
    state: "failed",
    cleanupPending: true,
    receipt: null,
    output: null,
  };
  const f = await fixture((request) => {
    if (request.operation === "job.get")
      return {
        ok: true,
        data: {
          ...job("failed", ++inspections === 1 ? 2 : 3),
          jobId: "recovery-job",
          target: { kind: "project", projectId: "p", revisionId: "r5" },
        },
      };
    return {
      ok: true,
      data: {
        ...base,
        recovery: {
          jobId: "recovery-job",
          state: request.operation === "export.recover" ? "queued" : "failed",
          published: null,
        },
      },
    };
  });
  const output = await f.run("export.recover", { exportId }, ["--wait", "--timeout-ms", "1000"]);
  expect(output.code).toBe(1);
  expect(JSON.parse(output.stdout)).toMatchObject({
    data: { ...base, recovery: { jobId: "recovery-job", state: "failed" } },
    wait: {
      state: "interrupted",
      job: { jobId: "recovery-job", generation: 2, attemptId: "attempt-2" },
      error: { code: "INVALID_RESPONSE" },
    },
  });
  expect(f.calls.map((r) => r.operation)).toEqual([
    "export.recover",
    "job.get",
    "export.status",
    "job.get",
  ]);
});

test.each(["capture.stop", "recording.get"])(
  "%s waits for recording.get after finalization",
  async (operation) => {
    let admissions = 0;
    const f = await fixture((request) => {
      if (request.operation === operation && admissions++ === 0)
        return { ok: true, data: { recordingId: "recording", state: "finalizing" } };
      expect(request.operation).toBe("recording.get");
      return {
        ok: true,
        data: { recordingId: "recording", state: "complete", sourceDurationUs: 42 },
      };
    });
    const output = await f.run(operation, { recordingId: "recording" }, [
      "--wait",
      "--timeout-ms",
      "1000",
    ]);
    expect(output.code).toBe(0);
    expect(JSON.parse(output.stdout)).toMatchObject({
      data: { recordingId: "recording", state: "complete" },
      wait: { state: "settled" },
    });
    expect(f.calls.map((r) => r.operation)).toEqual([operation, "recording.get"]);
  },
);

test("batch media delivery timeout reclassifies settled wait while keeping completed item facts", async () => {
  const f = await fixture(async (request) => {
    if (request.operation === "frame.batch")
      return {
        ok: true,
        data: {
          projectId: "p",
          revisionId: "r7",
          items: [
            {
              atUs: 7,
              ok: true,
              data: {
                state: "ready",
                published: { generation: 1, output: { mediaType: "image/png" } },
                delivery: { token: "slow", bytes: 2, expiresAt: Date.now() + 30000 },
              },
            },
          ],
        },
      };
    if (request.operation === "artifact.read") {
      await new Promise((resolve) => setTimeout(resolve, 180));
      return {
        ok: true,
        data: { offset: 0, nextOffset: 2, eof: true, data: Buffer.from("ok").toString("base64") },
      };
    }
    if (request.operation === "artifact.close") return { ok: true, data: { closed: true } };
    throw new Error(request.operation);
  });
  const output = await f.run("frame.batch", { projectId: "p", atUs: [7] }, [
    "--wait",
    "--timeout-ms",
    "80",
    "--output",
    `${f.home}/batch`,
  ]);
  expect(output.code).toBe(2);
  expect(JSON.parse(output.stdout)).toMatchObject({
    wait: { state: "timed_out" },
    data: { items: [{ atUs: 7 }] },
  });
});
