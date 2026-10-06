import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { Catalog } from "./catalog.js";
import { AssetStore } from "./assets.js";
import { AcquisitionStore } from "./acquisitions.js";
import { selectSpeakerSource } from "./source-speakers.js";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
});

async function fixture(
  available = [{ startUs: 0, endUs: 40_000_000 }],
  channels: number | null = 2,
) {
  const home = await mkdtemp("/tmp/source-speakers-");
  const catalog = new Catalog(join(home, "catalog.sqlite"));
  cleanup.push(async () => {
    catalog.close();
    await rm(home, { recursive: true, force: true });
  });
  const assets = new AssetStore(catalog, home);
  const acquisitions = new AcquisitionStore(catalog);
  await assets.recover();
  const original = join(home, "external.wav");
  await writeFile(original, "speaker source fixture");
  const asset = await assets.import(original, { kind: "import" }, async () => ({
    originUs: -250_000,
    streams: [
      {
        id: "a1",
        kind: "audio",
        codec: "fixture",
        decodable: true,
        startUs: 0,
        endUs: 40_000_000,
        ...(channels === null ? {} : { channels }),
        sampleRate: 48_000,
        segments: available.map((range) => ({ ...range, empty: false })),
      },
    ],
  }));
  const input = {
    assetId: asset.id,
    streamId: "a1",
    channel: 1,
    modelId: "speaker-runtime-control",
    sourceRange: { startUs: 1_000_000, endUs: 31_000_000 },
  };
  return {
    assets,
    acquisitions,
    asset,
    input,
    context(available: { startUs: number; endUs: number }[]) {
      const id = "selected-acquisition";
      catalog.catalog
        .prepare("INSERT INTO acquisitions VALUES(?,?,?,?)")
        .run(
          id,
          id,
          JSON.stringify({ kind: "import", path: "fixture", files: {} }),
          JSON.stringify({ id, bindings: [{ assetId: asset.id, streamId: "a1", available }] }),
        );
      return { ...input, acquisitionId: id };
    },
  };
}

test("speaker source admission refuses physical and acquisition gaps inside the observation", async () => {
  const physical = await fixture([
    { startUs: 0, endUs: 10_000_000 },
    { startUs: 10_000_001, endUs: 40_000_000 },
  ]);
  expect(() => selectSpeakerSource(physical.assets, physical.acquisitions, physical.input)).toThrow(
    "complete selected support",
  );
  const acquired = await fixture();
  const selected = acquired.context([
    { startUs: 0, endUs: 10_000_000 },
    { startUs: 10_000_001, endUs: 40_000_000 },
  ]);
  expect(() => selectSpeakerSource(acquired.assets, acquired.acquisitions, selected)).toThrow(
    "complete selected support",
  );
});

test("speaker admission retains the selected channel, exact source clock and complete support pin", async () => {
  const f = await fixture();
  const input = {
    ...f.input,
    sourceRange: {
      startUs: { numerator: 2_000_125, denominator: 2 },
      endUs: { numerator: 62_000_125, denominator: 2 },
    },
  };
  expect(selectSpeakerSource(f.assets, f.acquisitions, input)).toMatchObject({
    selection: { assetId: f.asset.id, streamId: "a1" },
    originUs: -250_000,
    channel: 1,
    sourceRange: input.sourceRange,
    track: {
      source: f.assets.path(f.asset.id),
      streamId: "a1",
      sourceOffsetUs: 250_000,
      available: [{ startUs: 0, endUs: 40_000_000 }],
    },
    expectedPCM: { sampleRate: 16_000, frames: 480_000 },
  });
});

test("speaker admission accepts a complete selected range on the 80ms score grid", async () => {
  const f = await fixture();
  expect(
    selectSpeakerSource(f.assets, f.acquisitions, {
      ...f.input,
      sourceRange: { startUs: 1_000_000, endUs: 11_000_000 },
    }).expectedPCM,
  ).toEqual({ sampleRate: 16_000, frames: 160_000 });
});

test("speaker admission refuses a range longer than the bounded provider window", async () => {
  const f = await fixture();
  expect(() =>
    selectSpeakerSource(f.assets, f.acquisitions, {
      ...f.input,
      sourceRange: { startUs: 0, endUs: 30_080_000 },
    }),
  ).toThrow("at most 30 seconds");
});

test("speaker admission refuses a selected range that cannot produce complete score cells", async () => {
  const f = await fixture();
  expect(() =>
    selectSpeakerSource(f.assets, f.acquisitions, {
      ...f.input,
      sourceRange: { startUs: 0, endUs: 10_040_000 },
    }),
  ).toThrow("80ms score grid");
});

test("speaker admission requires a real explicitly selected channel", async () => {
  const f = await fixture();
  expect(() => selectSpeakerSource(f.assets, f.acquisitions, { ...f.input, channel: 2 })).toThrow(
    "known source channel",
  );
  const unknown = await fixture(undefined, null);
  expect(() =>
    selectSpeakerSource(unknown.assets, unknown.acquisitions, { ...unknown.input, channel: 0 }),
  ).toThrow("known source channel");
});

test("speaker admission refuses an off-grid source start without rounding it", async () => {
  const f = await fixture();
  expect(() =>
    selectSpeakerSource(f.assets, f.acquisitions, {
      ...f.input,
      sourceRange: { startUs: 1_000_001, endUs: 31_000_001 },
    }),
  ).toThrow("16k sample grid");
});
