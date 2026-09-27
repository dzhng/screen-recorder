import { mkdtemp, writeFile, rename, readFile, rm } from "node:fs/promises";
import { watch } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { Catalog } from "./catalog.js";
import { AssetStore } from "./assets.js";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
async function setup() {
  const root = await mkdtemp(join(tmpdir(), "assets-"));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const catalog = new Catalog(join(root, "catalog.sqlite"));
  cleanups.push(async () => catalog.close());
  const store = new AssetStore(catalog, root);
  await store.recover();
  return { root, catalog, store };
}
const probe = async () => ({
  originUs: 0,
  streams: [
    {
      id: "image:0",
      kind: "image",
      codec: "public.png",
      decodable: true,
      width: 2,
      height: 1,
      orientedWidth: 2,
      orientedHeight: 1,
      orientation: 1,
    },
  ],
});
test("admission retains immutable bytes after an external rename and deduplicates", async () => {
  const { root, store } = await setup();
  const external = join(root, "external.png");
  await writeFile(external, "original pixels");
  const first = await store.import(external, { kind: "import" }, probe);
  await rename(external, external + ".moved");
  expect(await readFile(store.path(first.id), "utf8")).toBe("original pixels");
  const second = await store.import(external + ".moved", { kind: "import" }, probe);
  expect(second).toEqual(first);
  expect(store.list().assets).toEqual([first]);
});

test("concurrent imports publish one stable identity and preserve provenance", async () => {
  const { root, store } = await setup();
  const external = join(root, "same.png");
  await writeFile(external, "same pixels");
  const [a, b] = await Promise.all([
    store.import(external, { kind: "import" }, probe),
    store.import(external, { kind: "capture", source: "take-one" }, probe),
  ]);
  expect(a).toEqual(b);
  expect(store.list().assets).toEqual([a]);
  expect(store.origins(a.id)).toEqual([
    { kind: "capture", source: "take-one" },
    { kind: "import" },
  ]);
});

test("canceled and unsupported imports never publish assets, and startup removes unfinished bytes", async () => {
  const { root, store } = await setup();
  const external = join(root, "external.png");
  await writeFile(external, "some pixels");
  const controller = new AbortController();
  await expect(
    store.import(
      external,
      { kind: "import" },
      async () => {
        controller.abort();
        return probe();
      },
      controller.signal,
    ),
  ).rejects.toThrow();
  await expect(
    store.import(external, { kind: "import" }, async () => ({
      originUs: 0,
      streams: [{ id: "data", kind: "unsupported", codec: "x", decodable: false }],
    })),
  ).rejects.toMatchObject({ code: "UNSUPPORTED_MEDIA" });
  expect(store.list().assets).toEqual([]);
  const abandoned = join(root, "staging", "assets", "abandoned");
  const orphan = join(root, "assets", "unpublished");
  await writeFile(abandoned, "unfinished");
  await writeFile(orphan, "finished but no catalog commit");
  await store.recover();
  await expect(readFile(abandoned)).rejects.toMatchObject({ code: "ENOENT" });
  await expect(readFile(orphan)).rejects.toMatchObject({ code: "ENOENT" });
  const asset = await store.import(external, { kind: "import" }, probe);
  await store.recover();
  expect(await readFile(store.path(asset.id), "utf8")).toBe("some pixels");
});

test("receiving project and retained revision references survive donor release and roll back atomically", async () => {
  const { root, store, catalog } = await setup();
  const external = join(root, "external.png");
  await writeFile(external, "reference pixels");
  const asset = await store.import(external, { kind: "import" }, probe);
  const donor = { kind: "project" as const, id: "donor" };
  const recipient = { kind: "project" as const, id: "recipient" };
  const revision = { kind: "revision" as const, id: "recipient:r0" };
  catalog.transaction(() => {
    store.retain(donor, [asset.id]);
    store.retain(recipient, [asset.id]);
    store.retain(revision, [asset.id]);
  });
  store.release(donor);
  expect(store.references(asset.id)).toEqual([recipient, revision]);
  expect(() =>
    catalog.transaction(() => {
      store.release(recipient);
      store.release(revision);
      throw new Error("abort batch");
    }),
  ).toThrow("abort batch");
  expect(store.references(asset.id)).toEqual([recipient, revision]);
  expect(await readFile(store.path(asset.id), "utf8")).toBe("reference pixels");
});

test("an import receipt replays the admitted snapshot after restart and external deletion", async () => {
  const { root, store } = await setup();
  const external = join(root, "external.png");
  await writeFile(external, "snapshot pixels");
  const intent = await store.prepareImport("request", external);
  expect(await store.prepareImport("request", external)).toEqual(intent);
  await expect(store.prepareImport("request", external + ".other")).rejects.toThrowError(
    /another path/,
  );
  const asset = await store.executeImport(intent.importId, probe, new AbortController().signal);
  await rm(external);
  expect(
    await store.executeImport(
      intent.importId,
      async () => {
        throw new Error("must not reprobe");
      },
      new AbortController().signal,
    ),
  ).toEqual(asset);
  expect(store.intent(intent.importId).assetId).toBe(asset.id);
});

test("retry refuses changed source bytes instead of silently changing the frozen import", async () => {
  const { root, store } = await setup();
  const path = join(root, "source.png");
  await writeFile(path, "first bytes");
  const intent = await store.prepareImport("first", path);
  await writeFile(path, "replacement bytes");
  await expect(
    store.executeImport(intent.importId, probe, new AbortController().signal),
  ).rejects.toMatchObject({ code: "SOURCE_CHANGED" });
  expect(store.list().assets).toEqual([]);
  const replacement = await store.prepareImport("new-input", path);
  const asset = await store.executeImport(
    replacement.importId,
    probe,
    new AbortController().signal,
  );
  expect(await readFile(store.path(asset.id), "utf8")).toBe("replacement bytes");
});

test("failed publication rolls back the receipt and recovery removes the linked orphan", async () => {
  const { root, store } = await setup();
  const path = join(root, "source.png");
  await writeFile(path, "transaction pixels");
  await expect(
    store.import(
      path,
      { kind: "generated", source: "generation" },
      probe,
      new AbortController().signal,
      () => {
        throw new Error("crash before commit");
      },
    ),
  ).rejects.toThrow("crash before commit");
  expect(store.list().assets).toEqual([]);
  await store.recover();
  const asset = await store.import(path, { kind: "import" }, probe);
  expect(await readFile(store.path(asset.id), "utf8")).toBe("transaction pixels");
  expect(store.origins(asset.id)).toEqual([{ kind: "import" }]);
});

test("a source modified during streamed copying cannot become a ready asset", async () => {
  const { root, store } = await setup();
  const path = join(root, "changing.png");
  await writeFile(path, Buffer.alloc(32 * 1024 * 1024, 65));
  let mutation: Promise<void> | undefined;
  const watcher = watch(join(root, "staging", "assets"), () => {
    if (!mutation) mutation = writeFile(path, Buffer.alloc(32 * 1024 * 1024, 66));
  });
  try {
    await expect(store.import(path, { kind: "import" }, probe)).rejects.toMatchObject({
      code: "SOURCE_CHANGED",
    });
    await mutation;
    expect(store.list().assets).toEqual([]);
  } finally {
    watcher.close();
    await mutation;
  }
});
