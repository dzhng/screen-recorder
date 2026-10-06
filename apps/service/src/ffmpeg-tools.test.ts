import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, test } from "vitest";
import { callLocal } from "@yap/client";
import { startProjectService } from "./project-service.js";
import { compileCliOwner } from "./cli-owner.fixture.js";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanups.splice(0).reverse()) await close();
});
const sha = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");

test("tool discovery identifies only the selected relocated tools and refuses changed bytes without disabling native service", async () => {
  const home = await mkdtemp(join(tmpdir(), "yap-tools-"));
  cleanups.push(() => rm(home, { recursive: true, force: true }));
  const built = join(home, "Build tools"),
    moved = join(home, "Moved App.app", "tools");
  await mkdir(join(built, "bin"), { recursive: true });
  const files: Record<string, string> = {};
  const pidPath = join(home, "probe.pid");
  for (const name of ["ffmpeg", "ffprobe"]) {
    const bytes = `#!${process.execPath}\nimport { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(pidPath)}, String(process.pid));\nprocess.stdout.write(${JSON.stringify(`${name} version test-build Copyright\nconfiguration: --disable-gpl --disable-nonfree\n`)});\nsetTimeout(() => {}, 400);\n`;
    await writeFile(join(built, "bin", name), bytes, { mode: 0o755 });
    files[`bin/${name}`] = sha(bytes);
  }
  const receipt = JSON.stringify({
    format: 1,
    version: "test-build",
    sourceSha256: "a".repeat(64),
    recipeSha256: "b".repeat(64),
    files,
  });
  await writeFile(join(built, "receipt.json"), receipt);
  await mkdir(join(home, "Moved App.app"));
  await rename(built, moved);
  const service = await startProjectService({
    home,
    ffmpeg: { directory: moved, receiptSha256: sha(receipt) },
    worker: async () => ({ ok: true, data: {} }),
    nativeExecutable: await compileCliOwner(home),
  });
  cleanups.push(() => service.close());
  const fastHealth = await callLocal(
    service.socketPath,
    { id: "fast-health", operation: "service.health", params: {} },
    { timeoutMs: 250 },
  );
  expect(fastHealth).toMatchObject({ ok: true, data: { status: "ready" } });
  const tools = async () => {
    const result = await callLocal(service.socketPath, {
      id: "tools",
      operation: "service.tools",
      params: {},
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    return result.data as { node: { path: string }; ffmpeg: Record<string, unknown> };
  };
  const selected = await tools();
  expect(selected.node.path).toBe(process.execPath);
  expect(selected.ffmpeg).toMatchObject({
    available: true,
    directory: moved,
    version: "test-build",
    recipeSha256: "b".repeat(64),
    executables: {
      ffmpeg: { path: join(moved, "bin/ffmpeg"), sha256: files["bin/ffmpeg"] },
      ffprobe: { path: join(moved, "bin/ffprobe"), sha256: files["bin/ffprobe"] },
    },
  });
  const completedPid = Number(await readFile(pidPath, "utf8"));
  expect(() => process.kill(completedPid, 0)).toThrowError(
    expect.objectContaining({ code: "ESRCH" }),
  );
  const original = await readFile(join(moved, "bin/ffmpeg"));
  const originalProbe = await readFile(join(moved, "bin/ffprobe"));
  await writeFile(join(moved, "bin/ffmpeg"), "changed bytes");
  expect((await tools()).ffmpeg).toMatchObject({ available: false, code: "FFMPEG_UNAVAILABLE" });
  // A rewritten receipt cannot bless changed bytes against the app's pinned hash.
  const changed = JSON.parse(await readFile(join(moved, "receipt.json"), "utf8"));
  changed.files["bin/ffmpeg"] = sha("changed bytes");
  await writeFile(join(moved, "receipt.json"), JSON.stringify(changed));
  expect((await tools()).ffmpeg).toMatchObject({ available: false });
  await writeFile(join(moved, "receipt.json"), receipt);
  await writeFile(join(moved, "bin/ffmpeg"), original);
  await rm(join(moved, "bin/ffprobe"));
  execFileSync("mkfifo", [join(moved, "bin/ffprobe")]);
  const blocked = await callLocal(
    service.socketPath,
    { id: "fifo", operation: "service.tools", params: {} },
    { timeoutMs: 300 },
  );
  expect(blocked).toMatchObject({ ok: true, data: { ffmpeg: { available: false } } });
  await rm(join(moved, "bin/ffprobe"));
  expect((await tools()).ffmpeg).toMatchObject({ available: false });
  expect(
    await callLocal(service.socketPath, {
      id: "still-ready",
      operation: "service.health",
      params: {},
    }),
  ).toMatchObject({ ok: true, data: { status: "ready" } });
  await writeFile(join(moved, "bin/ffprobe"), originalProbe, { mode: 0o755 });
  const abort = new AbortController();
  const canceled = callLocal(
    service.socketPath,
    { id: "cancel-tools", operation: "service.tools", params: {} },
    { signal: abort.signal },
  ).catch((error: unknown) => error);
  let canceledPid = completedPid;
  const acknowledgedBy = performance.now() + 1000;
  try {
    while (canceledPid === completedPid && performance.now() < acknowledgedBy) {
      await delay(5);
      canceledPid = Number(await readFile(pidPath, "utf8"));
    }
    expect(canceledPid).not.toBe(completedPid);
  } finally {
    abort.abort();
  }
  expect(await canceled).toMatchObject({ code: "ABORTED" });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Canceled tool lookup did not drain promptly")),
      250,
    );
    void service
      .close()
      .finally(() => clearTimeout(timer))
      .then(resolve, reject);
  });
  expect(() => process.kill(canceledPid, 0)).toThrowError(
    expect.objectContaining({ code: "ESRCH" }),
  );
});
