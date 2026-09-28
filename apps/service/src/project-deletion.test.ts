import { mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import { DerivedCache } from "@screenrec/core/cache";
import { Catalog } from "@screenrec/core/catalog";
import { AssetStore } from "@screenrec/core/assets";
import { ProjectStore } from "@screenrec/core/projects";
import { JobQueue } from "@screenrec/core/jobs";
import { ProjectDeletion } from "./project-deletion.js";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("deletion drains canceled executors before releasing shared media; interruption resumes", async () => {
  const home = await mkdtemp(join(tmpdir(), "sr-del-"));
  const catalog = new Catalog(join(home, "catalog.sqlite"));
  const assets = new AssetStore(catalog, home);
  const projects = new ProjectStore(catalog, assets);
  const started = deferred();
  const aborted = deferred();
  const exit = deferred();
  const queue = new JobQueue({
    store: catalog,
    providers: { newId: randomUUID },
    targets: {
      pin(target) {
        if (target.kind !== "project") throw new Error("Expected project");
        projects.revision(target.projectId, target.revisionId);
        return target;
      },
      isAvailable(target) {
        if (target.kind !== "project") return false;
        try {
          projects.revision(target.projectId, target.revisionId);
          return true;
        } catch {
          return false;
        }
      },
      isDeleting: (owner) => owner.kind === "project" && projects.isDeleting(owner.projectId),
      isCapturing: () => false,
    },
    execute: async ({ signal }) => {
      signal.addEventListener("abort", () => aborted.resolve(), { once: true });
      started.resolve();
      await exit.promise;
      return "late-result";
    },
  });
  const cache = new DerivedCache(catalog, home, (owner) => {
    if (owner.kind !== "project") throw new Error("Expected project cache owner");
    projects.get(owner.projectId);
  });
  await cache.reconcile();
  // Native filesystem deletion is the external seam; catalog, leases and lifetime are real.
  const files = {
    async removeCacheFiles(ids: string[]) {
      for (const id of ids) await unlink(join(home, "cache", "derived", `${id}.cache`));
    },
  };
  const deletion = new ProjectDeletion(projects, queue, cache, files);
  let releaseRead: (() => void) | undefined;
  try {
    await assets.recover();
    const path = join(home, "source.wav");
    await writeFile(path, "retained source bytes");
    const asset = await assets.import(path, { kind: "import" }, async () => ({
      originUs: 0,
      streams: [
        {
          id: "audio",
          kind: "audio",
          codec: "pcm",
          decodable: true,
          startUs: 0,
          endUs: 1000,
          segments: [{ startUs: 0, endUs: 1000, empty: false }],
        },
      ],
    }));
    const create = (requestId: string) =>
      projects.create({
        requestId,
        canvas: {
          width: 160,
          height: 96,
          fps: { numerator: 30, denominator: 1 },
          background: "#000000ff",
        },
      });
    const one = create("one"),
      two = create("two");
    const place = (project: typeof one) =>
      projects.apply(project.project.projectId, {
        requestId: "place",
        expectedRevisionId: project.revision.id,
        operations: [
          { operation: "track.add", track: { kind: "audio", order: 0 }, label: "track" },
          {
            operation: "place",
            clip: {
              trackId: { label: "track" },
              assetId: asset.id,
              streamId: "audio",
              source: { kind: "range", range: { startUs: 0, endUs: 1000 } },
              placement: { kind: "project", range: { startUs: 0, endUs: 1000 } },
            },
          },
        ],
      });
    const first = place(one),
      second = place(two);
    const target = {
      kind: "project" as const,
      projectId: one.project.projectId,
      revisionId: first.revision.id,
    };
    const cached = cache.reserve(target);
    await writeFile(cached.path, "cached first project");
    await cache.publish(cached.id);
    const sibling = cache.reserve({ kind: "project", projectId: two.project.projectId });
    await writeFile(sibling.path, "cached second project");
    await cache.publish(sibling.id);
    const read = cache.acquire(cached.id)!;
    releaseRead = () => read.release();
    const job = queue.submit({ target, artifact: "fixture", lane: "heavy", input: "input" });
    await started.promise;
    const removing = deletion.delete(target.projectId);
    expect(deletion.delete(target.projectId)).toBe(removing);
    await aborted.promise;
    expect(
      assets
        .references(asset.id)
        .map((r) => r.id)
        .sort(),
    ).toEqual([first.revision.id, second.revision.id].sort());
    expect(() => projects.get(target.projectId)).toThrow(/does not exist/);
    expect(() => queue.retry(job.jobId)).toThrow();
    const failed = expect(removing).rejects.toMatchObject({
      code: "DELETE_FAILED",
      retryable: true,
    });
    const closing = deletion.close();
    exit.resolve();
    await failed;
    await closing;
    expect(projects.deletionsPage().projectIds).toEqual([target.projectId]);
    const resumed = new ProjectDeletion(projects, queue, cache, files);
    try {
      const failures: unknown[] = [];
      await resumed.resume((error) => failures.push(error));
      expect(failures).toEqual([
        expect.objectContaining({ code: "DELETE_FAILED", retryable: true }),
      ]);
      expect(projects.deletionsPage().projectIds).toEqual([target.projectId]);
      expect(assets.references(asset.id).map((ref) => ref.id).sort()).toEqual(
        [first.revision.id, second.revision.id].sort(),
      );
      expect(await readFile(cached.path, "utf8")).toBe("cached first project");
      expect(() => cache.acquire(cached.id)).toThrow(/does not exist/);
      releaseRead();
      releaseRead = undefined;
      failures.length = 0;
      await resumed.resume((error) => failures.push(error));
      expect(failures).toEqual([]);
      expect([...cache.usageFiles(target)]).toEqual([]);
      await expect(readFile(cached.path)).rejects.toMatchObject({ code: "ENOENT" });
      expect(await readFile(sibling.path, "utf8")).toBe("cached second project");
      expect(await readFile(assets.path(asset.id), "utf8")).toBe("retained source bytes");
      expect(projects.deletionsPage().projectIds).toEqual([]);
      expect(assets.references(asset.id)).toEqual([{ kind: "revision", id: second.revision.id }]);
      expect(assets.get(asset.id)).toEqual(asset);
      expect(() => queue.job(job.jobId)).toThrow(/not found|does not exist/i);
      expect(projects.revision(two.project.projectId)).toEqual(second.revision);
      expect(await resumed.delete(target.projectId)).toEqual({
        projectId: target.projectId,
        deleted: true,
      });
    } finally {
      await resumed.close();
    }
  } finally {
    releaseRead?.();
    exit.resolve();
    await deletion.close();
    await queue.close();
    catalog.close();
    await rm(home, { recursive: true, force: true });
  }
});
