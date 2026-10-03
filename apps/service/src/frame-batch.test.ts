import { afterEach, expect, test } from "vitest";
import { writeFile, readFile, chmod } from "node:fs/promises";
import type { OperationFailure, OperationResult } from "@screenrec/protocol";
import type { MediaFrameInspection } from "@screenrec/core/frame-inspection";
import type { SourceSelection } from "@screenrec/core/source-selection";
import type { DerivativeDelivery } from "./delivery.js";
import { projectServiceFixture } from "./project-service.fixture.js";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanups.splice(0).reverse()) await close();
});
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7l8AAAAASUVORK5CYII=",
  "base64",
);
type FrameStatus = Extract<
  ReturnType<MediaFrameInspection["request"]>,
  { assetId: string; atUs: number }
> & {
  delivery: ReturnType<DerivativeDelivery["open"]>;
};
type FrameItem =
  | ({ atUs: number } & OperationFailure)
  | { atUs: number; ok: true; data: FrameStatus };
function batch(reply: OperationResult) {
  expect(reply.ok).toBe(true);
  if (!reply.ok) throw new Error(JSON.stringify(reply));
  return reply.data as SourceSelection & { items: FrameItem[] };
}
async function fixture() {
  const attempts: number[] = [],
    failures = new Set<number>();
  const f = await projectServiceFixture(cleanups, async (operation, params) => {
    if (operation === "media.probe")
      return {
        ok: true,
        data: {
          originUs: 0,
          streams: [
            {
              id: "v",
              kind: "video",
              codec: "fixture",
              decodable: true,
              startUs: 0,
              endUs: 1_000_000,
              segments: [{ startUs: 0, endUs: 1_000_000, empty: false }],
              width: 1,
              height: 1,
              orientedWidth: 1,
              orientedHeight: 1,
            },
          ],
        },
      };
    expect(operation).toBe("media.sourceFrame");
    const at = Number(params.atUs);
    attempts.push(at);
    if (failures.has(at))
      return {
        ok: false,
        error: {
          code: "NATIVE_DECODE_FAILED",
          message: "controlled picture failure",
          retryable: true,
          details: {},
        },
      };
    const asset = params.asset as { assetId: string; streamId: string };
    await writeFile(String(params.output), png, { flag: "wx" });
    // This native edge proves service/cache/delivery behavior, not decoded pixel quality.
    return {
      ok: true,
      data: {
        file: params.output,
        mediaType: "image/png",
        assetId: asset.assetId,
        streamId: asset.streamId,
        requestedSourceUs: at,
        actualSourceUs: at,
        sample: {
          value: String(at),
          timescale: 1_000_000,
          endValue: String(at + 100_000),
          endTimescale: 1_000_000,
          originUs: 0,
        },
        width: 1,
        height: 1,
        sourceWidth: 1,
        sourceHeight: 1,
        decodedSamples: 1,
        readerOpens: 1,
        bytes: png.length,
      },
    };
  });
  const imported = await f.call("asset.import", { requestId: "batch-source", path: f.path });
  if (!imported.ok) throw new Error(JSON.stringify(imported));
  const job = imported.data as { jobId: string };
  const asset = (await f.job(job.jobId, "ready")).result!;
  return { ...f, selection: { assetId: asset.assetId, streamId: "v" }, attempts, failures };
}
async function ready(f: Awaited<ReturnType<typeof fixture>>, atUs: number[]) {
  let result = batch(await f.call("frame.batch", { ...f.selection, atUs }));
  for (const item of result.items)
    if (item.ok && item.data.jobId) await f.job(item.data.jobId, "ready");
  result = batch(await f.call("frame.batch", { ...f.selection, atUs }));
  return result;
}
async function closeDeliveries(f: Awaited<ReturnType<typeof fixture>>, items: FrameItem[]) {
  for (const item of items)
    if (item.ok && item.data.delivery)
      expect(await f.call("artifact.close", { token: item.data.delivery.token })).toMatchObject({
        ok: true,
        data: { closed: true },
      });
}

test("service source batches isolate invalid admission and retain ordered duplicate jobs and complete bytes", async () => {
  const f = await fixture(),
    atUs = [0, 1_000_000, 0, 500_000];
  const result = await ready(f, atUs);
  expect(result.items.map((item) => item.atUs)).toEqual(atUs);
  expect(result.items[1]).toMatchObject({
    atUs: 1_000_000,
    ok: false,
    error: { code: "INVALID_RANGE" },
  });
  const good = result.items.filter((item) => item.ok);
  expect(good.map((item) => item.data.state)).toEqual(["ready", "ready", "ready"]);
  expect(good[0]!.data.published).toEqual(good[1]!.data.published);
  expect(good[0]!.data.jobId).toBe(good[1]!.data.jobId);
  for (const item of good) {
    expect(item.data.published!.frame).toMatchObject({
      ...f.selection,
      atUs: item.atUs,
      requestedSourceUs: item.atUs,
      actualSourceUs: item.atUs,
    });
    const part = await f.call("artifact.read", { token: item.data.delivery!.token, offset: 0 });
    expect(part).toMatchObject({
      ok: true,
      data: { offset: 0, nextOffset: png.length, eof: true, data: png.toString("base64") },
    });
    expect(await readFile(item.data.published!.frame.file)).toEqual(png);
  }
  expect([...f.attempts].sort((a, b) => a - b)).toEqual([0, 500_000]);
  await closeDeliveries(f, result.items);
});

test("service source batches isolate an unreadable cached sibling", async () => {
  const f = await fixture();
  const initial = await ready(f, [0]);
  const first = initial.items[0]!;
  if (!first.ok) throw new Error(JSON.stringify(first));
  const file = first.data.published!.frame.file;
  await closeDeliveries(f, initial.items);
  await chmod(file, 0);
  try {
    const result = batch(await f.call("frame.batch", { ...f.selection, atUs: [0, 500_000] }));
    expect(result.items[0]).toMatchObject({
      atUs: 0,
      ok: false,
      error: { code: "INTERNAL_ERROR" },
    });
    const next = result.items[1]!;
    if (!next.ok || !next.data.jobId) throw new Error(JSON.stringify(next));
    await f.job(next.data.jobId, "ready");
    const retained = await ready(f, [500_000]);
    expect(retained.items[0]).toMatchObject({ atUs: 500_000, ok: true, data: { state: "ready" } });
    const item = retained.items[0]!;
    if (!item.ok) throw new Error(JSON.stringify(item));
    expect(await readFile(item.data.published!.frame.file)).toEqual(png);
    await closeDeliveries(f, retained.items);
    expect([...f.attempts].sort((a, b) => a - b)).toEqual([0, 500_000]);
  } finally {
    await chmod(file, 0o600);
  }
});

test("service source batches require independent explicit retry of a failed picture", async () => {
  const f = await fixture();
  f.failures.add(500_000);
  const first = batch(await f.call("frame.batch", { ...f.selection, atUs: [0, 500_000] }));
  const good = first.items[0]!,
    bad = first.items[1]!;
  if (!good.ok || !bad.ok) throw new Error(JSON.stringify(first));
  await f.job(good.data.jobId!, "ready");
  const until = Date.now() + 3000;
  for (;;) {
    const reply = await f.call("job.get", { jobId: bad.data.jobId! });
    if (!reply.ok) throw new Error(JSON.stringify(reply));
    if ((reply.data as { state: string }).state === "failed") break;
    if (Date.now() >= until) throw new Error("controlled picture did not fail");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  const failed = batch(await f.call("frame.batch", { ...f.selection, atUs: [0, 500_000] }));
  expect(failed.items[1]).toMatchObject({
    ok: true,
    data: { state: "failed", jobId: bad.data.jobId, published: null },
  });
  const published = failed.items[0]!;
  if (!published.ok) throw new Error(JSON.stringify(published));
  expect([...f.attempts].sort((a, b) => a - b)).toEqual([0, 500_000]);
  await closeDeliveries(f, failed.items);
  f.failures.delete(500_000);
  const retry = await f.call("frame.retry", { ...f.selection, atUs: 500_000 });
  expect(retry).toMatchObject({ ok: true, data: { jobId: bad.data.jobId } });
  await f.job(bad.data.jobId!, "ready");
  const final = await ready(f, [0, 500_000]);
  expect(final.items[0]).toMatchObject({ ok: true, data: { published: published.data.published } });
  expect(final.items[1]).toMatchObject({
    ok: true,
    data: { state: "ready", jobId: bad.data.jobId, published: { generation: 2 } },
  });
  for (const item of final.items) {
    if (!item.ok) throw new Error(JSON.stringify(item));
    expect(await readFile(item.data.published!.frame.file)).toEqual(png);
  }
  expect([...f.attempts].sort((a, b) => a - b)).toEqual([0, 500_000, 500_000]);
  await closeDeliveries(f, final.items);
});
