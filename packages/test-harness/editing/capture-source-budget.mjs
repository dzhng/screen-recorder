import assert from "node:assert/strict";
import { parseArgs } from "node:util";
import { execFileSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { mkdtemp, mkdir, cp, copyFile, readFile, writeFile, rm, access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  startPublicService,
  seedCapture,
  publicCommand,
} from "../../../apps/macos/tests/fixtures/public-service.mjs";
const { values } = parseArgs({
  options: {
    out: { type: "string" },
    fixture: { type: "string" },
    expect: { type: "string", default: "ready" },
    cancel: { type: "boolean", default: false },
  },
});
assert(values.out && values.fixture && process.env.YAP_NATIVE);
const out = resolve(values.out);
await mkdir(out);
const home = await mkdtemp("/tmp/source-budget-");
const hash = (data) => createHash("sha256").update(data).digest("hex");
const report = {
  passed: false,
  calls: [],
  workerSHA256: hash(await readFile(process.env.YAP_NATIVE)),
};
const save = (name, value) => writeFile(join(out, name), JSON.stringify(value, null, 2) + "\n");
let service;
try {
  const receipt = JSON.parse(
    await readFile(join(values.fixture, "narration.publication.json"), "utf8"),
  );
  const take = await seedCapture(home, {
    recordingId: randomUUID(),
    sourceId: receipt.intent.sourceID,
    sourceDurationUs: 10_000_100_001,
  });
  const source = join(home, "library", "recordings", take.recordingId, "source");
  await cp(values.fixture, source, { recursive: true });
  await copyFile(
    resolve("specs/done/agent-editing/assets/00-corpus/video-only.mov"),
    join(source, "video.mov"),
  );
  report.inputs = Object.fromEntries(
    await Promise.all(
      ["capture.journal.jsonl", "narration.mov", "narration.publication.json"].map(async (name) => [
        name,
        hash(await readFile(join(source, name))),
      ]),
    ),
  );
  service = await startPublicService(home, process.env.YAP_NATIVE);
  async function call(operation, params) {
    const started = performance.now();
    const response = await service.call(operation, params);
    report.calls.push({ operation, seconds: (performance.now() - started) / 1000, response });
    assert(response.ok, JSON.stringify(response));
    return response.data;
  }
  const importParams = { requestId: randomUUID(), path: source };
  const start = performance.now();
  report.submitted = publicCommand(service.socket, "acquisition.import", importParams);
  const selector = { jobId: report.submitted.jobId };
  if (values.cancel) {
    const health = await call("service.health", {});
    const deadline = performance.now() + 10000;
    let nativePid;
    while (!nativePid && performance.now() < deadline) {
      const children = execFileSync("/bin/ps", ["-axo", "pid=,ppid=,command="], {
        encoding: "utf8",
      });
      for (const line of children.split("\n")) {
        const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/);
        if (match && Number(match[2]) === health.pid && match[3] === process.env.YAP_NATIVE)
          nativePid = Number(match[1]);
      }
      if (!nativePid) await delay(20);
    }
    assert(nativePid, "Source verification must be executing in its actual native child");
    report.canceledNativePid = nativePid;
    report.cancellation = await call("recording.delete", { recordingId: take.recordingId });
    assert.equal(report.cancellation.deleted, true);
    assert.throws(() => process.kill(nativePid, 0), { code: "ESRCH" });
    await assert.rejects(access(source), { code: "ENOENT" });
    for (const [name, digest] of Object.entries(report.inputs))
      assert.equal(hash(await readFile(join(values.fixture, name))), digest);
    report.seconds = (performance.now() - start) / 1000;
    report.passed = true;
  } else {
    let terminal;
    while (performance.now() - start < 180000) {
      const status = await call("job.get", selector);
      if (["ready", "failed", "canceled"].includes(status.state)) {
        terminal = status;
        break;
      }
      await delay(500);
    }
    report.seconds = (performance.now() - start) / 1000;
    report.terminal = terminal;
    const expected = values.expect;
    assert.equal(terminal?.state, expected, JSON.stringify(terminal));
    if (expected === "ready") {
      const acquisition = await call("acquisition.get", {
        acquisitionId: terminal.published.output.acquisitionId,
      });
      assert.equal(acquisition.evidence.receipt.audioIntervals, 100000);
      assert.equal(
        acquisition.evidence.receipt.publications.narration.canonical.sha256,
        receipt.canonical.sha256,
      );
      await copyFile(acquisition.evidence.receipt.file, join(out, "normalized.jsonl"));
      report.normalizedSHA256 = hash(await readFile(join(out, "normalized.jsonl")));
      report.retained = await call("acquisition.get", { acquisitionId: acquisition.id });
      assert.deepEqual(report.retained, acquisition);
    } else assert.equal(terminal.published, null);
    for (const [name, digest] of Object.entries(report.inputs))
      assert.equal(hash(await readFile(join(source, name))), digest);
    report.passed = true;
  }
} catch (error) {
  report.error = String(error);
  throw error;
} finally {
  await service?.close();
  await save("report.json", report);
  await rm(home, { recursive: true, force: true });
}
