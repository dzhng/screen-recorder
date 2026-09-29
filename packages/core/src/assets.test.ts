import { mkdtemp, writeFile, rename, readFile, rm, open, type FileHandle } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { Catalog } from "./catalog.js";
import { AssetStore, compositionAsset } from "./assets.js";

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
  const admit = async (requestId: string, path: string) => {
    const prepared = await store.prepareImport(requestId, path);
    return catalog.transaction(() => store.admitImport(prepared));
  };
  return { root, catalog, store, admit };
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
  expect(store.list().assets.map((asset) => asset.id)).toEqual([first.id]);
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
  expect(store.list().assets.map((asset) => asset.id)).toEqual([a.id]);
  expect(store.origins(a.id).origins).toEqual([
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
  const { root, store, admit } = await setup();
  const external = join(root, "external.png");
  await writeFile(external, "snapshot pixels");
  const intent = await admit("request", external);
  expect(await admit("request", external)).toEqual(intent);
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
  const { root, store, admit } = await setup();
  const path = join(root, "source.png");
  await writeFile(path, "first bytes");
  const intent = await admit("first", path);
  await writeFile(path, "replacement bytes");
  await expect(
    store.executeImport(intent.importId, probe, new AbortController().signal),
  ).rejects.toMatchObject({ code: "SOURCE_CHANGED" });
  expect(store.list().assets).toEqual([]);
  const replacement = await admit("new-input", path);
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
  expect(store.origins(asset.id).origins).toEqual([{ kind: "import" }]);
});

test("a source modified during streamed copying cannot become a ready asset", async () => {
  const { root, store } = await setup();
  const path = join(root, "changing.png");
  await writeFile(path, "original pixels");
  const source = await open(path, "r+");
  const before = await source.stat();
  const read = source.read;
  let mutated = false;
  // Hold the first real read's completion until a real same-size source write
  // finishes. This places mutation inside copying without scheduling a watcher.
  const reading = vi
    .spyOn(Object.getPrototypeOf(source), "read")
    .mockImplementationOnce(async function (this: FileHandle, ...args: unknown[]) {
      const result = await Reflect.apply(read, this, args);
      await source.write(Buffer.from("changed!"), 0, 8, 0);
      // Filesystem timestamp granularity must not decide whether the mutation is seen.
      await source.utimes(before.atime, new Date(before.mtimeMs + 1000));
      mutated = true;
      return result;
    });
  try {
    await expect(store.import(path, { kind: "import" }, probe)).rejects.toMatchObject({
      code: "SOURCE_CHANGED",
    });
    expect(mutated).toBe(true);
    expect(store.list().assets).toEqual([]);
  } finally {
    reading.mockRestore();
    await source.close();
  }
});

test("distinct frozen import paths deduplicate media while preserving both origins", async () => {
  const { root, store, admit } = await setup();
  const firstPath = join(root, "first.png"),
    secondPath = join(root, "second.png");
  await writeFile(firstPath, "shared pixels");
  await writeFile(secondPath, "shared pixels");
  const first = await admit("first", firstPath),
    second = await admit("second", secondPath);
  const a = await store.executeImport(first.importId, probe, new AbortController().signal);
  const b = await store.executeImport(second.importId, probe, new AbortController().signal);
  expect(b.id).toBe(a.id);
  expect(store.origins(a.id).origins).toEqual([
    { kind: "import", source: firstPath },
    { kind: "import", source: secondPath },
  ]);
});

test("additive native response fields do not prevent importing valid known media", async () => {
  const { root, store } = await setup();
  const path = join(root, "source.png");
  await writeFile(path, "future metadata");
  const asset = await store.import(path, { kind: "import" }, async () => {
    const metadata = await probe();
    return {
      ...metadata,
      id: "not-the-asset-identity",
      future: { information: true },
      streams: metadata.streams.map((stream) => ({ ...stream, futureTag: "additive" })),
    };
  });
  expect(asset.id).toMatch(/^[a-f0-9]{64}$/);
  expect(store.get(asset.id).streams).toEqual((await probe()).streams);
});

test("asset lists stay compact while get preserves large source timing metadata", async () => {
  const { root, store } = await setup();
  const path = join(root, "many-edits.mov");
  await writeFile(path, "timed media");
  const segments = Array.from({ length: 5000 }, (_, startUs) => ({
    startUs,
    endUs: startUs + 1,
    empty: false,
    mediaStartUs: startUs,
    mediaDurationUs: 1,
  }));
  const asset = await store.import(path, { kind: "import" }, async () => ({
    originUs: 0,
    streams: [
      { id: "v", kind: "video", codec: "avc1", decodable: true, startUs: 0, endUs: 5000, segments },
    ],
  }));
  expect(store.get(asset.id).streams[0]!.segments).toEqual(segments);
  const page = store.list();
  expect(JSON.stringify(page).length).toBeLessThan(512);
  expect(page.assets).toEqual([
    {
      id: asset.id,
      bytes: asset.bytes,
      createdAt: asset.createdAt,
      fileName: asset.fileName,
      mediaKinds: ["video"],
      streamCount: 1,
      fontFaceCount: 0,
    },
  ]);
});

test("rejected admission rolls back the frozen intent with its caller transaction", async () => {
  const { root, catalog, store, admit } = await setup();
  const path = join(root, "source.png");
  await writeFile(path, "first candidate");
  const prepared = await store.prepareImport("capacity-refusal", path);
  let rejectedId = "";
  expect(() =>
    catalog.transaction(() => {
      rejectedId = store.admitImport(prepared).importId;
      throw new Error("job capacity refused");
    }),
  ).toThrow("job capacity refused");
  expect(() => store.intent(rejectedId)).toThrow("does not exist");
  await writeFile(path, "new candidate after failed admission");
  const accepted = await admit("capacity-refusal", path);
  const asset = await store.executeImport(accepted.importId, probe, new AbortController().signal);
  expect(await readFile(store.path(asset.id), "utf8")).toBe("new candidate after failed admission");
});

test("font assets retain face identities without advertising playable streams", async () => {
  const { root, store } = await setup();
  const path = join(root, "faces.ttc");
  await writeFile(path, "immutable collection bytes");
  const fontFaces = [
    { postScriptName: "Example-Regular", familyName: "Example", styleName: "Regular" },
    { postScriptName: "Example-Bold", familyName: "Example", styleName: "Bold" },
  ];
  const asset = await store.import(path, { kind: "import" }, async () => ({
    originUs: 0,
    streams: [],
    fontFaces,
  }));
  expect(store.get(asset.id).fontFaces).toEqual(fontFaces);
  expect(store.list().assets).toEqual([
    {
      id: asset.id,
      bytes: asset.bytes,
      createdAt: asset.createdAt,
      fileName: asset.fileName,
      streamCount: 0,
      mediaKinds: [],
      fontFaceCount: 2,
    },
  ]);
  expect(store.portable(asset.id).asset.fontFaces).toEqual(fontFaces);
  expect(compositionAsset(asset)).toEqual({
    id: asset.id,
    streams: [],
    fontFaces: fontFaces.map((face) => face.postScriptName),
  });
  const recipient = await setup();
  const staged = await recipient.store.stagePortable(
    store.portable(asset.id),
    store.path(asset.id),
    new AbortController().signal,
  );
  recipient.catalog.transaction(() => staged.publish());
  await staged.close();
  expect(recipient.store.get(asset.id)).toEqual(asset);
  const invalidPortable = store.portable(asset.id);
  invalidPortable.asset.fontFaces = [fontFaces[0]!, fontFaces[0]!];
  await expect(
    recipient.store.stagePortable(
      invalidPortable,
      store.path(asset.id),
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ code: "INVALID_PACKAGE" });
  expect(await readFile(recipient.store.path(asset.id))).toEqual(
    await readFile(store.path(asset.id)),
  );
  await rename(path, path + ".renamed");
  expect(
    await store.import(path + ".renamed", { kind: "import" }, async () => {
      throw Error("Must reuse immutable identity");
    }),
  ).toEqual(asset);
});

test("font metadata rejects ambiguous identities and cannot smuggle timed streams", async () => {
  const { root, store } = await setup();
  const path = join(root, "invalid-font.ttf");
  await writeFile(path, "invalid font metadata");
  const face = { postScriptName: "Repeated", familyName: "Example" };
  for (const metadata of [
    { originUs: 0, streams: [], fontFaces: [] },
    { originUs: 0, streams: [], fontFaces: [face, face] },
    { originUs: 1, streams: [], fontFaces: [face] },
    { ...(await probe()), fontFaces: [face] },
    { originUs: 0, streams: [] },
  ]) {
    await expect(
      store.import(path, { kind: "import" }, async () => metadata),
    ).rejects.toMatchObject({ code: "INVALID_NATIVE_RESPONSE" });
    expect(store.list().assets).toEqual([]);
  }
});

test("verified byte digest is enforced before both fresh and cached asset publication", async () => {
  const { root, store } = await setup();
  const path = join(root, "verified.png");
  await writeFile(path, "original pixels");
  const { fileIdentity } = await import("./files.js");
  const file = await open(path, "r");
  const stat = await file.stat({ bigint: true });
  await file.close();
  const expected = {
    path,
    bytes: Number(stat.size),
    identity: fileIdentity(stat),
    sha256: "0".repeat(64),
  };
  const observed = vi.fn(probe);
  const publish = vi.fn();
  await expect(
    store.import(
      path,
      { kind: "capture", source: "wrong-proof" },
      observed,
      new AbortController().signal,
      publish,
      expected,
    ),
  ).rejects.toMatchObject({ code: "SOURCE_CHANGED" });
  expect(store.list().assets).toEqual([]);
  expect(observed).not.toHaveBeenCalled();
  const correct = await store.import(path, { kind: "import" }, probe);
  await expect(
    store.import(
      path,
      { kind: "capture", source: "wrong-proof" },
      observed,
      new AbortController().signal,
      publish,
      expected,
    ),
  ).rejects.toMatchObject({ code: "SOURCE_CHANGED" });
  expect(store.origins(correct.id).origins).toEqual([{ kind: "import" }]);
  expect(publish).not.toHaveBeenCalled();
  const accepted = await store.import(
    path,
    { kind: "capture", source: "verified" },
    observed,
    new AbortController().signal,
    publish,
    { ...expected, sha256: correct.id },
  );
  expect(accepted.id).toBe(correct.id);
  expect(store.origins(correct.id).origins).toContainEqual({ kind: "capture", source: "verified" });
});

test("sparse admission preserves leading, inter-run and trailing physical gaps at the occupied-run capacity", async () => {
  const { root, store } = await setup();
  const path = join(root, "sparse.mov");
  await writeFile(path, "sparse metadata fixture");
  const runs = 100_000;
  const segments = Array.from({ length: 2 * runs + 1 }, (_, index) => ({
    startUs: index * 100,
    endUs: (index + 1) * 100,
    empty: index % 2 === 0,
    ...(index % 2 ? { mediaStartUs: ((index - 1) / 2) * 100, mediaDurationUs: 100 } : {}),
  }));
  const metadata = {
    originUs: 100001,
    streams: [
      {
        id: "audio:0",
        kind: "audio",
        codec: "pcm",
        decodable: true,
        startUs: 0,
        endUs: segments.at(-1)!.endUs,
        sampleRate: 48000,
        channels: 1,
        segments,
      },
    ],
  };
  const asset = await store.import(path, { kind: "import" }, async () => metadata);
  const restored = store.get(asset.id);
  expect(restored.streams[0]!.segments).toEqual(segments);
  expect(compositionAsset(restored).streams[0]).toMatchObject({
    available: segments
      .filter((row) => !row.empty)
      .map(({ startUs, endUs }) => ({ startUs, endUs })),
  });
  const excessive = join(root, "excessive.mov");
  await writeFile(excessive, "different sparse metadata fixture");
  await expect(
    store.import(excessive, { kind: "import" }, async () => ({
      ...metadata,
      streams: [
        { ...metadata.streams[0], segments: [...segments, { startUs: 0, endUs: 1, empty: true }] },
      ],
    })),
  ).rejects.toMatchObject({ code: "INVALID_NATIVE_RESPONSE" });
});
