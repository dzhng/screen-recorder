import { afterAll, beforeAll, expect, it } from "vitest";
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { fstatSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { join } from "node:path";
import { compileCliOwner } from "./cli-owner.fixture.js";
import { withFfmpegArtifact } from "./ffmpeg-artifact.js";
import type { MediaWorker } from "./worker.js";

let directory: string, owner: string, writer: string, parent: string;
beforeAll(async () => {
  directory = await mkdtemp("/tmp/yap-cli-artifact-");
  parent = join(directory, "attempts");
  await mkdir(parent, { mode: 0o700 });
  owner = await compileCliOwner(directory);
  writer = join(directory, "writer.cjs");
  await writeFile(
    writer,
    "require('node:fs').writeSync(Number(process.argv[2]),'valid media bytes');",
  );
});
afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});
// Cleanup is a native boundary; existing render tests own its rename/identity contract.
const cleanup: MediaWorker = async (operation, params, options) => {
  expect(operation).toBe("storage.clearRenderWorkspace");
  const selected = options!.descriptors![0]!;
  const held = fstatSync(selected, { bigint: true });
  expect(params.expectedDirectory).toEqual({ dev: String(held.dev), ino: String(held.ino) });
  for (const name of await readdir(parent)) await rm(join(parent, name), { recursive: true });
  return { ok: true, data: { removed: true } };
};

it("domain-validated held output is consumed before attempt cleanup", async () => {
  let artifactPath = "";
  const result = await withFfmpegArtifact(
    cleanup,
    {
      attemptParent: parent,
      filename: "artifact.bin",
      executable: process.execPath,
      ownerExecutable: owner,
      descriptors: [],
      args: (slot) => [writer, String(slot)],
    },
    new AbortController().signal,
    async (file) => {
      expect(await file.readFile("utf8")).toBe("valid media bytes");
      return { validated: true };
    },
    async (artifact) => {
      artifactPath = artifact.path;
      expect(await readFile(artifact.path, "utf8")).toBe("valid media bytes");
      expect(artifact.evidence).toEqual({ validated: true });
      expect(artifact.bytes).toBe(17);
      expect(artifact.sha256).toBe(
        "14af64267df6a4113df33a3b57b2b0c860828d246422cf868ac6d0a4d397e075",
      );
      return "consumed";
    },
  );
  expect(result).toBe("consumed");
  await expect(readFile(artifactPath)).rejects.toMatchObject({ code: "ENOENT" });
  expect(await readdir(parent)).toEqual([]);
});

it("exit zero cannot admit bytes rejected by the domain validator", async () => {
  let consumed = false;
  await expect(
    withFfmpegArtifact(
      cleanup,
      {
        attemptParent: parent,
        filename: "rejected.bin",
        executable: process.execPath,
        ownerExecutable: owner,
        descriptors: [],
        args: (slot) => [writer, String(slot)],
      },
      new AbortController().signal,
      async () => {
        throw new Error("domain rejected media");
      },
      async () => {
        consumed = true;
      },
    ),
  ).rejects.toThrow("domain rejected media");
  expect(consumed).toBe(false);
  expect(await readdir(parent)).toEqual([]);
});

it("cancellation retires the writer before staging cleanup or consumption", async () => {
  const slow = join(directory, "slow.cjs");
  const ready = join(directory, "ready");
  await writeFile(
    slow,
    "const fs=require('node:fs');fs.writeSync(Number(process.argv[2]),'partial');fs.writeFileSync(process.argv[3],String(process.pid));setInterval(()=>{},1000);",
  );
  const controller = new AbortController();
  let consumed = false,
    validated = false;
  const pending = withFfmpegArtifact(
    cleanup,
    {
      attemptParent: parent,
      filename: "partial.bin",
      executable: process.execPath,
      ownerExecutable: owner,
      descriptors: [],
      args: (slot) => [slow, String(slot), ready],
    },
    controller.signal,
    async () => {
      validated = true;
    },
    async () => {
      consumed = true;
    },
  ).then(
    () => undefined,
    (error) => error,
  );
  let pid: number | undefined;
  try {
    for (let n = 0; n < 200; n++) {
      try {
        pid = Number(await readFile(ready, "utf8"));
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      await delay(10);
    }
    expect(pid).toBeGreaterThan(0);
  } finally {
    controller.abort();
  }
  expect(await pending).toMatchObject({ code: "CANCELED" });
  expect(() => process.kill(pid!, 0)).toThrow();
  expect(validated).toBe(false);
  expect(consumed).toBe(false);
  expect(await readdir(parent)).toEqual([]);
});

it("a replaced output locator cannot reach validation or consumption", async () => {
  const replacing = join(directory, "replacing.cjs");
  await writeFile(
    replacing,
    "const fs=require('node:fs'),p=require('node:path');fs.writeSync(Number(process.argv[2]),'allocated');const target=p.join(process.argv[3],fs.readdirSync(process.argv[3])[0],'changed.bin');fs.unlinkSync(target);fs.writeFileSync(target,'replacement');",
  );
  let validated = false,
    consumed = false;
  await expect(
    withFfmpegArtifact(
      cleanup,
      {
        attemptParent: parent,
        filename: "changed.bin",
        executable: process.execPath,
        ownerExecutable: owner,
        descriptors: [],
        args: (slot) => [replacing, String(slot), parent],
      },
      new AbortController().signal,
      async () => {
        validated = true;
      },
      async () => {
        consumed = true;
      },
    ),
  ).rejects.toMatchObject({
    code: "INVALID_STORAGE",
    message: "CLI staged output changed before validation",
  });
  expect(validated).toBe(false);
  expect(consumed).toBe(false);
  expect(await readdir(parent)).toEqual([]);
});
