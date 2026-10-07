import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const root = new URL("../../../", import.meta.url).pathname;
const evidence = join(
  root,
  "specs/video-editing-feedback/assets/01-corpus-multicam/native/report.json",
);
const fixtures = join(root, "fixtures/video-editing-feedback/synchronization");

test("replays native delivery for every caller-authored retained multicam selection", async () => {
  const { verifyRetainedMulticamNativeDelivery } = await import("./multicam-native-delivery.mjs");
  const replay = await verifyRetainedMulticamNativeDelivery(evidence, fixtures);
  assert.equal(replay.ok, true);
  assert.equal(replay.kind, "retained-multicam-native-delivery");
  assert.deepEqual(replay.sources, ["grahamRaw", "lilyRawP1", "madisonRaw"]);
  assert.equal(replay.selectionCount, 9);
  assert.equal(replay.synchronization, "not-established");
  assert.equal(replay.cameraChoice, "caller-authored");
});

test("refuses a native multicam receipt whose retained picture binding changed", async (t) => {
  const { verifyRetainedMulticamNativeDelivery } = await import("./multicam-native-delivery.mjs");
  const directory = await mkdtemp(join(tmpdir(), "yap-multicam-native-receipt-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await cp(dirname(evidence), directory, { recursive: true });
  const report = JSON.parse(await readFile(evidence, "utf8"));
  report.selections[0].sourcePictureSha256 = "0".repeat(64);
  const mutated = join(directory, "report.json");
  await writeFile(mutated, `${JSON.stringify(report)}\n`);
  await assert.rejects(verifyRetainedMulticamNativeDelivery(mutated, fixtures), {
    code: "PICTURE_SELECTION",
  });
});

test("refuses changed native worker, frame, and preview receipt identities", async (t) => {
  const { verifyRetainedMulticamNativeDelivery } = await import("./multicam-native-delivery.mjs");
  const cases = [
    {
      name: "worker",
      mutate: (report) => (report.nativeSha256 = "0".repeat(64)),
      code: "NATIVE_IDENTITY",
    },
    {
      name: "frame",
      mutate: (report) => (report.selections[0].nativeFrame.rgbSha256 = "0".repeat(64)),
      code: "NATIVE_FRAME",
    },
    {
      name: "preview",
      mutate: (report) => (report.preview.fileSha256 = "0".repeat(64)),
      code: "NATIVE_PREVIEW",
    },
    {
      name: "preview-metric",
      mutate: (report) => (report.selections[0].previewFrame.mae = null),
      code: "NATIVE_PREVIEW",
    },
  ];
  for (const item of cases) {
    const directory = await mkdtemp(join(tmpdir(), `yap-multicam-native-${item.name}-`));
    t.after(() => rm(directory, { recursive: true, force: true }));
    await cp(dirname(evidence), directory, { recursive: true });
    const report = JSON.parse(await readFile(evidence, "utf8"));
    item.mutate(report);
    const mutated = join(directory, "report.json");
    await writeFile(mutated, `${JSON.stringify(report)}\n`);
    await assert.rejects(
      verifyRetainedMulticamNativeDelivery(mutated, fixtures),
      { code: item.code },
      item.name,
    );
  }
});

test("refuses a retained worker identity artifact with the wrong kind", async (t) => {
  const { verifyRetainedMulticamNativeDelivery } = await import("./multicam-native-delivery.mjs");
  const directory = await mkdtemp(join(tmpdir(), "yap-multicam-native-worker-kind-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await cp(dirname(evidence), directory, { recursive: true });
  const workerIdentityPath = join(directory, "worker-identity.json");
  const workerIdentity = JSON.parse(await readFile(workerIdentityPath, "utf8"));
  workerIdentity.kind = "unretained-worker";
  await writeFile(workerIdentityPath, `${JSON.stringify(workerIdentity)}\n`);
  await assert.rejects(
    verifyRetainedMulticamNativeDelivery(join(directory, "report.json"), fixtures),
    { code: "NATIVE_IDENTITY" },
  );
});

test("refuses a retained frame artifact without a file hash", async (t) => {
  const { verifyRetainedMulticamNativeDelivery } = await import("./multicam-native-delivery.mjs");
  const directory = await mkdtemp(join(tmpdir(), "yap-multicam-native-frame-hash-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await cp(dirname(evidence), directory, { recursive: true });
  const report = JSON.parse(await readFile(evidence, "utf8"));
  delete report.selections[0].nativeFrame.fileSha256;
  await writeFile(join(directory, "report.json"), `${JSON.stringify(report)}\n`);
  await assert.rejects(
    verifyRetainedMulticamNativeDelivery(join(directory, "report.json"), fixtures),
    { code: "NATIVE_FRAME" },
  );
});
