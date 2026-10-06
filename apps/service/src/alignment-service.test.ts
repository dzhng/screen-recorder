import { afterEach, expect, test } from "vitest";
import { join } from "node:path";
import { Catalog } from "@yap/core/catalog";
import { AssetStore } from "@yap/core/assets";
import { AcquisitionStore } from "@yap/core/acquisitions";
import { Models } from "@yap/core/models";
import { ResourceReferences } from "@yap/core/references";
import {
  AlignmentEvidenceStore,
  assetAlignmentOwner,
  alignmentGenerationResource,
} from "@yap/core/alignment-evidence";
import { selectAlignmentSource } from "@yap/core/source-alignment";
import { alignmentSource, alignmentOutput } from "./alignment.fixture.js";
import { projectServiceFixture } from "./project-service.fixture.js";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
const probe = {
  originUs: 0,
  streams: [
    {
      id: "a1",
      kind: "audio",
      codec: "control",
      decodable: true,
      channels: 2,
      sampleRate: 16000,
      startUs: 0,
      endUs: 2000000,
      segments: [{ startUs: 0, endUs: 2000000, empty: false }],
    },
  ],
};
test("public alignment preparation refuses unavailable runtime and incomplete support without inference", async () => {
  const requests: string[] = [];
  const f = await projectServiceFixture(cleanup, async (operation) => {
    requests.push(operation);
    if (operation !== "media.probe") throw new Error(operation);
    return { ok: true, data: probe };
  });
  const imported = await f.call("asset.import", { requestId: "alignment", path: f.path });
  if (!imported.ok) throw new Error(JSON.stringify(imported));
  const job = await f.job((imported.data as { jobId: string }).jobId, "ready");
  const input = {
    assetId: job.published!.output.assetId,
    streamId: "a1",
    channel: 0,
    sourceRange: alignmentSource.observationRange,
    text: alignmentSource.text,
    modelId: "nemo-ctc110",
  };
  expect(await f.call("alignment.prepare", input)).toMatchObject({
    ok: true,
    data: { state: "unavailable", reason: "model_not_prepared", published: null },
  });
  expect(
    await f.call("alignment.prepare", { ...input, sourceRange: { startUs: 0, endUs: 3000000 } }),
  ).toMatchObject({ ok: false, error: { code: "UNAVAILABLE_SUPPORT" } });
  expect(requests).toEqual(["media.probe"]);
});
test("public pinned pages, thresholds and original bytes survive restart without models or native work", async () => {
  const f = await projectServiceFixture(cleanup, async (operation) => {
    if (operation !== "media.probe") throw new Error(operation);
    return { ok: true, data: probe };
  });
  const imported = await f.call("asset.import", { requestId: "retained-alignment", path: f.path });
  if (!imported.ok) throw new Error(JSON.stringify(imported));
  const job = await f.job((imported.data as { jobId: string }).jobId, "ready"),
    assetId = job.published!.output.assetId;
  const library = join(f.home, "library"),
    catalog = new Catalog(join(library, "catalog.sqlite"));
  const assets = new AssetStore(catalog, library),
    acquisitions = new AcquisitionStore(catalog),
    models = new Models(library);
  const selected = selectAlignmentSource(assets, acquisitions, {
    assetId,
    streamId: "a1",
    channel: 0,
    sourceRange: alignmentSource.observationRange,
    text: alignmentSource.text,
    modelId: "nemo-ctc110",
  });
  const evidence = new AlignmentEvidenceStore(catalog, assetAlignmentOwner(assets, acquisitions));
  const source = {
    ...alignmentSource,
    supportDigest: selected.supportDigest,
    engine: models.alignment("nemo-ctc110").engine,
  };
  const values = alignmentOutput();
  for (const field of ["nativeReceipt", "report"] as const) {
    const value = JSON.parse(values[field]);
    value.modelSha256 = source.engine.modelSha256;
    values[field] = JSON.stringify(value);
  }
  const identity = {
    owner: { kind: "asset" as const, assetId },
    generation: "retained-alignment-g1",
    policy: "alignment-v1" as const,
  };
  const staged = evidence.stage(identity, source, values);
  catalog.transaction(() => {
    staged.publish();
    new ResourceReferences(catalog).retain("alignment-generation", { kind: "asset", id: assetId }, [
      alignmentGenerationResource(identity),
    ]);
  });
  const failedIdentity = { ...identity, generation: "retained-alignment-failed" };
  const failedOperands = { ...values, report: "{}", correspondence: "" };
  evidence.capture(failedIdentity, source, failedOperands);
  catalog.transaction(() =>
    new ResourceReferences(catalog).retain("alignment-generation", { kind: "asset", id: assetId }, [
      alignmentGenerationResource(failedIdentity),
    ]),
  );
  catalog.close();
  expect(
    await f.call("alignment.get", {
      assetId,
      generation: failedIdentity.generation,
      view: "raw",
      operand: "report",
    }),
  ).toMatchObject({
    ok: true,
    data: {
      state: "captured",
      page: { evidence: { verified: false }, bytesBase64: Buffer.from("{}").toString("base64") },
    },
  });
  expect(
    await f.call("alignment.get", { assetId, generation: failedIdentity.generation }),
  ).toMatchObject({ ok: false, error: { code: "NOT_READY" } });
  const query = {
    assetId,
    generation: identity.generation,
    view: "acoustic",
    thresholdRMS: 0.1,
    limit: 3,
  };
  const first = await f.call("alignment.get", query);
  expect(first).toMatchObject({
    ok: true,
    data: {
      state: "ready",
      generation: identity.generation,
      page: {
        rows: [{ activity: "quiet" }, { activity: "quiet" }, { activity: "quiet" }],
        nextCursor: expect.any(String),
      },
    },
  });
  if (!first.ok) throw new Error(JSON.stringify(first));
  const cursor = (first.data as { page: { nextCursor: string } }).page.nextCursor;
  const next = await f.call("alignment.get", { ...query, cursor });
  await f.service.close();
  const restarted = await projectServiceFixture(
    cleanup,
    async (operation) => {
      throw new Error(`Unexpected native work ${operation}`);
    },
    f.home,
  );
  expect(await restarted.call("alignment.get", { ...query, cursor })).toEqual(next);
  expect(
    await restarted.call("alignment.get", { ...query, cursor, thresholdRMS: 0.2 }),
  ).toMatchObject({ ok: false, error: { code: "ARTIFACT_CHANGED" } });
  expect(
    await restarted.call("alignment.get", {
      assetId,
      generation: identity.generation,
      view: "raw",
      operand: "report",
    }),
  ).toMatchObject({
    ok: true,
    data: { page: { bytesBase64: Buffer.from(values.report).toString("base64") } },
  });
  expect(await restarted.call("alignment.get", { assetId, generation: "other" })).toMatchObject({
    ok: false,
    error: { code: "NOT_READY" },
  });
});
