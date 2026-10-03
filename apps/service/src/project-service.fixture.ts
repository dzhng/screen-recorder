import { createHash } from "node:crypto";
import { writeSync } from "node:fs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { expect } from "vitest";
import { callLocal } from "@screenrec/client";
import { encodeJsonLine, REQUEST_FRAME_BYTES } from "@screenrec/protocol";
import { startProjectService } from "./project-service.js";
import type { MediaWorker } from "./worker.js";

export function probeFileFixture(home: string, worker: MediaWorker): MediaWorker {
  return async (operation, params, options) => {
    // Preserve the real worker's strict wire boundary even when its execution is a fixture.
    encodeJsonLine({ id: "fixture", operation, params }, REQUEST_FRAME_BYTES);
    if (operation === "media.audioCapabilities") return { ok: true, data: {} };
    if (operation === "storage.clearRenderWorkspace") {
      const parent = params.parent as { name: string } | undefined;
      if (parent)
        await rm(join(home, "library", "render", parent.name), { recursive: true, force: true });
      return { ok: true, data: { removed: true } };
    }
    const result = await worker(operation, params, options);
    if (operation !== "media.probe" || !result.ok) return result;
    // Model the native file handoff; each test still supplies its own probe result/error.
    const bytes = Buffer.from(JSON.stringify(result.data));
    const index = Number(String(params.output).split("/").at(-1)) - 3;
    writeSync(options!.descriptors![index]!, bytes, 0, bytes.length, 0);
    return {
      ok: true,
      data: {
        file: params.output,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      },
    };
  };
}
export async function projectServiceFixture(
  cleanups: (() => Promise<void>)[],
  worker: MediaWorker,
  existingHome?: string,
) {
  const home = existingHome ?? (await mkdtemp(join(tmpdir(), "asset-service-")));
  if (!existingHome) cleanups.push(() => rm(home, { recursive: true, force: true }));
  const path = join(home, "source.png");
  await writeFile(path, "image bytes");
  const service = await startProjectService({
    home,
    worker: probeFileFixture(home, worker),
  });
  cleanups.push(() => service.close());
  async function call(operation: string, params: Record<string, unknown>) {
    const result = await callLocal(service.socketPath, { id: "test", operation, params });
    if (result.ok && ["job.get", "job.retry", "job.cancel", "asset.import"].includes(operation)) {
      expect(result.data).not.toHaveProperty("input");
      expect(result.data).toHaveProperty("inputSha256", expect.stringMatching(/^[a-f0-9]{64}$/));
    }
    return result;
  }
  async function job(jobId: string, state: string) {
    const deadline = performance.now() + 3000;
    for (;;) {
      const result = await call("job.get", { jobId });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const data = result.data as {
          state: string;
          result: { assetId: string } | null;
          errorCode: string | null;
        };
        if (data.state === state) return data;
        if (["failed", "unavailable", "canceled"].includes(data.state))
          throw new Error(`Unexpected terminal job: ${JSON.stringify(data)}`);
      }
      if (performance.now() >= deadline)
        throw new Error(`Job never reached ${state}: ${JSON.stringify(result)}`);
      await delay(10);
    }
  }
  return { home, path, service, call, job };
}
