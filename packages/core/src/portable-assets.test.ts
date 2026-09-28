import { mkdtemp, rm, writeFile, readFile, readdir, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { test, expect } from "vitest";
import { Catalog } from "./catalog.js";
import { AssetStore } from "./assets.js";

test("portable asset staging checks bytes before atomic publication and preserves transitive references", async () => {
  const home = await mkdtemp(join(tmpdir(), "portable-assets-"));
  const catalog = new Catalog(join(home, "catalog.sqlite"));
  const assets = new AssetStore(catalog, home);
  try {
    await assets.recover();
    const source = join(home, "source.wav");
    const bytes = Buffer.from("original-lossless-source");
    await writeFile(source, bytes);
    const id = createHash("sha256").update(bytes).digest("hex");
    const metadata = {
      id,
      bytes: bytes.length,
      createdAt: "2026-09-28",
      fileName: `${id}.wav`,
      originUs: 0,
      streams: [
        {
          id: "audio",
          kind: "audio" as const,
          codec: "pcm",
          decodable: true,
          startUs: 0,
          endUs: 1000,
          segments: [{ startUs: 0, endUs: 1000, empty: false }],
        },
      ],
    };
    await expect(
      assets.stagePortable(
        { asset: { ...metadata, id: "0".repeat(64) }, origins: [], dependencies: [] },
        source,
        new AbortController().signal,
      ),
    ).rejects.toThrow(/hash/);
    expect(assets.list().assets).toEqual([]);
    const staged = await assets.stagePortable(
      { asset: metadata, origins: [{ kind: "generated" }], dependencies: [] },
      source,
      new AbortController().signal,
    );
    expect(assets.list().assets).toEqual([]);
    expect(() =>
      catalog.transaction(() => {
        staged.publish();
        throw new Error("rollback");
      }),
    ).toThrow("rollback");
    expect(assets.list().assets).toEqual([]);
    catalog.transaction(() => staged.publish());
    expect(assets.get(id)).toEqual(metadata);
    expect(assets.origins(id).origins).toEqual([{ kind: "generated" }]);
    expect(await readFile(assets.path(id))).toEqual(bytes);
    await staged.close();
    const controller = new AbortController();
    controller.abort();
    await expect(
      assets.stagePortable(
        { asset: metadata, origins: [], dependencies: [] },
        source,
        controller.signal,
      ),
    ).rejects.toThrow();
    const conflicting = await assets.stagePortable(
      { asset: { ...metadata, originUs: 500 }, origins: [], dependencies: [] },
      source,
      new AbortController().signal,
    );
    expect(() => catalog.transaction(() => conflicting.publish())).toThrow(/metadata conflicts/);
    await conflicting.close();
    const renamed = await assets.stagePortable(
      { asset: { ...metadata, fileName: `${id}.flac` }, origins: [], dependencies: [] },
      source,
      new AbortController().signal,
    );
    catalog.transaction(() => renamed.publish());
    await renamed.close();
    expect(await readdir(join(home, "assets"))).toEqual([metadata.fileName]);
    await chmod(assets.path(id), 0o600);
    await writeFile(assets.path(id), Buffer.alloc(bytes.length));
    await expect(
      assets.stagePortable(
        { asset: { ...metadata, fileName: `${id}.flac` }, origins: [], dependencies: [] },
        source,
        new AbortController().signal,
      ),
    ).rejects.toThrow(/file hash conflicts/);
  } finally {
    catalog.close();
    await rm(home, { recursive: true, force: true });
  }
});
