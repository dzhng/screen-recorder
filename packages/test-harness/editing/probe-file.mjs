import assert from "node:assert/strict";
import { mkdir, open, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { gzipSync } from "node:zlib";
import { assetProbe, readMediaProbe } from "../../../apps/service/dist/media-probe.js";
import { mediaWorker, nativeResult } from "../../../apps/service/dist/worker.js";

const { values } = parseArgs({
  options: {
    out: { type: "string" },
    bulk: { type: "string" },
    expected: { type: "string" },
    font: { type: "string" },
  },
});
assert.ok(values.out && process.env.SCREENREC_NATIVE);
const out = resolve(values.out);
await mkdir(out);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const report = {
  passed: false,
  workerSha256: hash(await readFile(process.env.SCREENREC_NATIVE)),
  checks: [],
};
const worker = mediaWorker();
const controller = new AbortController();
const lifetime = await open(out, "r");
try {
  const corpus = fileURLToPath(
    new URL("../../../specs/done/agent-editing/assets/00-corpus/", import.meta.url),
  );
  const inputs = ["orientation.mov", "timestamp-gap.mov", "a-audio.wav", "odd-canvas.png"].map(
    (name) => join(corpus, name),
  );
  if (values.font) inputs.push(resolve(values.font));
  for (const path of inputs) {
    const expected = nativeResult(await worker("media.probe", { path }));
    const actual = await assetProbe(worker, join(out, "attempts"))(
      path,
      controller.signal,
      lifetime,
    );
    assert.deepEqual(actual, expected);
    report.checks.push({ path, sha256: hash(await readFile(path)), inlineAndFileEqual: true });
  }
  if (values.bulk) {
    const path = resolve(values.bulk);
    const input = await open(path, "r");
    let actual;
    try {
      actual = await readMediaProbe(worker, out, "/dev/fd/3", controller.signal, [
        input.fd,
        lifetime.fd,
      ]);
    } finally {
      await input.close();
    }
    if (values.expected) {
      const expected = JSON.parse(await readFile(resolve(values.expected), "utf8"));
      assert.deepEqual(actual, expected.data ?? expected);
    }
    const bytes = Buffer.from(JSON.stringify(actual));
    await writeFile(join(out, "bulk-metadata.json.gz"), gzipSync(bytes));
    report.bulk = {
      path,
      inputSha256: hash(await readFile(path)),
      metadataBytes: bytes.length,
      metadataSha256: hash(bytes),
      streams: actual.streams.map((s) => ({
        id: s.id,
        physicalRows: s.segments?.length,
        occupiedRows: s.segments?.filter((r) => !r.empty).length,
        emptyRows: s.segments?.filter((r) => r.empty).length,
      })),
    };
  }
  assert.deepEqual(await readdir(join(out, "attempts")), []);
  report.passed = true;
} finally {
  await lifetime.close();
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
}
