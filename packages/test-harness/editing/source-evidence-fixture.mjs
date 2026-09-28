import assert from "node:assert/strict";
import { execFile, fork } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import { constants } from "node:fs";
import { copyFile, lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { cliReply } from "./first-preview-transport.mjs";

export const run = promisify(execFile);
export const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const root = new URL("../../../", import.meta.url).pathname;
export async function poll(read, done, label) {
  const deadline = performance.now() + 180000;
  for (;;) {
    const value = await read();
    if (done(value)) return value;
    assert.ok(!["failed", "canceled"].includes(value.state), `${label}: ${JSON.stringify(value)}`);
    assert.ok(performance.now() < deadline, `${label}: deadline`);
    await delay(100);
  }
}

/** Copies already prepared, hash-pinned files. No network fetch or preparation operation. */
export async function copyModels(home, request) {
  const { parakeetModel: manifest, SpeechModels } =
    await import("../../../packages/core/dist/speech-models.js");
  assert.deepEqual(request.files, manifest.files);
  const models = new SpeechModels(join(home, "library"));
  const target = join(home, "library/models", manifest.name, manifest.revision);
  const receipt = { modelDigest: models.modelDigest, files: {} };
  for (const file of manifest.files) {
    const source = join(request.directory, file.path);
    const destination = join(target, manifest.folderName, file.path);
    assert.ok((await lstat(source)).isFile());
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination, constants.COPYFILE_FICLONE);
    const bytes = await readFile(destination);
    assert.equal(bytes.length, file.bytes);
    assert.equal(hash(bytes), file.sha256);
    const stat = await lstat(destination, { bigint: true });
    receipt.files[file.path] = { modifiedNs: String(stat.mtimeNs), inode: String(stat.ino) };
  }
  await writeFile(join(target, "receipt.json"), JSON.stringify(receipt));
  assert.deepEqual(models.status(), { state: "ready" });
  return { modelDigest: models.modelDigest, files: manifest.files };
}

/** Public transports around a scratch project service; barriers hold only real native replies. */
export class JourneyService {
  constructor(home, report, evidence) {
    this.home = home;
    this.evidence = evidence;
    this.report = report;
    this.logs = [];
    this.barriers = new Map();
  }
  async start() {
    this.child = fork(
      new URL("./source-acquisition-service.mjs", import.meta.url),
      [this.home, ...(this.evidence ? [this.evidence] : [])],
      {
        stdio: ["ignore", "pipe", "pipe", "ipc"],
      },
    );
    this.child.stdout.on("data", (b) => this.logs.push(b.toString()));
    this.child.stderr.on("data", (b) => this.logs.push(b.toString()));
    this.child.on("message", (m) => {
      if (m.type) this.barriers.set(`${m.id}/${m.type}`, m);
    });
    const [ready] = await Promise.race([
      once(this.child, "message"),
      once(this.child, "exit").then(([code]) => {
        throw new Error(`Service exited ${code}: ${this.logs.join("")}`);
      }),
      delay(30000, undefined, { ref: false }).then(() => {
        throw new Error("Service startup deadline");
      }),
    ]);
    assert.equal(ready.error, undefined, JSON.stringify(ready));
    this.socketPath = ready.socketPath;
    this.mcp = new Client({ name: "source-transcript-journey", version: "1" });
    await this.mcp.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [join(root, "apps/cli/dist/main.js"), "mcp", "--socket", this.socketPath],
        stderr: "pipe",
      }),
    );
  }
  async call(operation, params, { transport = "cli", error = false, output } = {}) {
    const response =
      transport === "mcp"
        ? (await this.mcp.callTool({ name: operation, arguments: params })).structuredContent
        : await cliReply([
            join(root, "apps/cli/dist/main.js"),
            operation,
            "--socket",
            this.socketPath,
            "--params",
            JSON.stringify(params),
            ...(output ? ["--output", output] : []),
          ]);
    assert.equal(response?.ok, !error, `${operation}: ${JSON.stringify(response)}`);
    this.report.trace.push({
      operation,
      transport,
      ok: response.ok,
      state: response.data?.state,
      error: response.error,
    });
    return response.ok ? response.data : response.error;
  }
  async arm(operation) {
    const id = randomUUID();
    this.child.send({ type: "barrier.arm", id, operation, remaining: 1 });
    await poll(
      () => this.barriers.get(`${id}/barrier.armed`) ?? {},
      (v) => v.type === "barrier.armed",
      "arm",
    );
    return () =>
      poll(
        () => this.barriers.get(`${id}/barrier.hit`) ?? {},
        (v) => v.nativeSucceeded,
        "native reply",
      );
  }
  async stop(crash = false) {
    await this.mcp?.close();
    this.mcp = undefined;
    const child = this.child;
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, "exit");
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error("Service shutdown deadline"));
      }, 15000);
      timer.unref();
    });
    if (crash) child.kill("SIGKILL");
    else child.send("close");
    try {
      const [code, signal] = await Promise.race([exited, timeout]);
      if (crash) assert.equal(signal, "SIGKILL");
      else assert.equal(code, 0, this.logs.join(""));
    } catch (error) {
      await exited;
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Synthetic acquisition journals around real speech bytes; not a physical capture claim. */
export async function acquisitionDonor(directory, narration, available) {
  await mkdir(directory, { recursive: true });
  await copyFile(
    join(root, "fixtures/narrated-workbench/video.mov"),
    join(directory, "video.mov"),
    constants.COPYFILE_FICLONE,
  );
  await copyFile(narration, join(directory, "narration.mov"), constants.COPYFILE_FICLONE);
  const records = [
    {
      event: "header",
      data: {
        schemaVersion: 1,
        sessionID: `synthetic-source-journey-${randomUUID()}`,
        source: { kind: "window", windowID: 7 },
        width: 3120,
        height: 1970,
        microphone: true,
        systemAudio: false,
      },
    },
    { event: "origin", data: { hostUs: 1000000 } },
    ...available.map((range) => ({ event: "audioSamples", data: { role: "narration", ...range } })),
    { event: "finished", data: {} },
    { event: "lifecycle", data: { state: "complete" } },
  ];
  const raw = records.map((r, i) => JSON.stringify({ ...r, sequence: i + 1 }) + "\n").join("");
  await writeFile(join(directory, "capture.journal.jsonl"), raw);
  return hash(raw);
}
