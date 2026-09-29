import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { JourneyService, poll, run, hash } from "./source-evidence-fixture.mjs";
import { writeSourceWave, sample } from "./audio-project-fixture.mjs";

const { values } = parseArgs({
  options: { out: { type: "string" }, query: { type: "string", default: "timeline" } },
});
assert.ok(process.env.SCREENREC_NATIVE);
assert.ok(["timeline", "waveform"].includes(values.query));
const out = values.out ? resolve(values.out) : await mkdtemp("/tmp/screenrec-duration-memory-");
await mkdir(out, { recursive: true });
const source = join(out, "source.wav");
await writeSourceWave(source, { source: 0, seconds: 1 });
const occurrences = 10000,
  clipUs = 100000,
  rowsPerQuery = 250;
const report = {
  passed: false,
  scope:
    "Sampled service resident memory for equal-cardinality two/four-hour " +
    values.query +
    " queries; no native decode or movie memory claim",
  query: values.query,
  sourceSha256: hash(await readFile(source)),
  nativeSha256: hash(await readFile(process.env.SCREENREC_NATIVE)),
  nodeVersion: process.version,
  controls: { occurrences, clipUs, rowsPerQuery, repeats: 20, trialsPerDuration: 3 },
  cases: [],
};
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const save = () => writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
try {
  // Alternate order to avoid assigning all earlier/later machine conditions to one duration.
  for (const seconds of [7200, 14400, 14400, 7200, 7200, 14400]) {
    const home = await realpath(await mkdtemp("/tmp/sr-duration-memory-"));
    const trial = { seconds, home, trace: [], samples: [], queryMs: [] };
    report.cases.push(trial);
    const service = new JourneyService(home, trial);
    const call = (operation, params) => service.call(operation, params, { transport: "mcp" });
    let sampling,
      sampleError,
      stopped = false,
      succeeded = false;
    try {
      await service.start();
      const imported = await call("asset.import", { path: source, requestId: "source" });
      const ready = await poll(
        () => call("job.get", { jobId: imported.jobId }),
        (x) => x.state === "ready",
        "source import",
      );
      const asset = await call("asset.get", { assetId: ready.result.assetId });
      const made = await call("project.create", {
        requestId: "project",
        canvas: {
          width: 16,
          height: 16,
          fps: { numerator: 30, denominator: 1 },
          background: "#000000ff",
        },
      });
      const projectId = made.project.projectId;
      let revisionId = made.revision.id;
      const apply = async (operations, requestId) => {
        const result = await call("edit.apply", {
          projectId,
          expectedRevisionId: revisionId,
          requestId,
          operations,
        });
        revisionId = result.revision.id;
        return result;
      };
      const track = (
        await apply(
          [{ operation: "track.add", label: "track", track: { kind: "audio", order: 0 } }],
          "track",
        )
      ).edit.labels.track;
      const durationUs = seconds * 1e6;
      const starts = Array.from({ length: occurrences }, (_, i) =>
        Math.floor((i * (durationUs - clipUs)) / (occurrences - 1)),
      );
      for (let first = 0; first < occurrences; first += 500) {
        await apply(
          starts.slice(first, first + 500).map((startUs) => ({
            operation: "place",
            clip: {
              trackId: track,
              assetId: asset.id,
              streamId: asset.streams[0].id,
              source: { kind: "range", range: { startUs: 0, endUs: clipUs } },
              placement: { kind: "project", range: { startUs, endUs: startUs + clipUs } },
            },
          })),
          `place-${first}`,
        );
      }
      // Authoring allocations cannot inflate this process's query memory baseline.
      await service.stop();
      await service.start();
      trial.queryPid = service.child.pid;
      const rss = async () => {
        const bytes =
          Number((await run("ps", ["-o", "rss=", "-p", String(trial.queryPid)])).stdout.trim()) *
          1024;
        assert.ok(Number.isFinite(bytes) && bytes > 0);
        return bytes;
      };
      trial.baselineBytes = await rss();
      sampling = (async () => {
        while (!stopped) {
          trial.samples.push({ atMs: performance.now(), bytes: await rss() });
          await delay(20);
        }
      })().catch((error) => {
        sampleError = error;
        trial.samplerError = { message: error.message };
        stopped = true;
      });
      const expected = starts
        .flatMap((startUs) => [startUs, startUs + clipUs])
        .filter((x) => x > 0 && x < durationUs)
        .sort((a, b) => a - b)
        .slice(0, rowsPerQuery);
      const readTimeline = async () => {
        const rows = [];
        let cursor,
          pages = 0;
        do {
          const page = await poll(
            () =>
              call("timeline.events", {
                projectId,
                revisionId,
                range: { startUs: 0, endUs: durationUs },
                limit: rowsPerQuery - rows.length,
                ...(cursor ? { cursor } : {}),
              }),
            (x) => x.state === "ready",
            "query page",
          );
          rows.push(...page.page.rows);
          cursor = page.page.nextCursor;
          assert.ok(++pages <= 100, "Continuation must make bounded progress");
        } while (rows.length < rowsPerQuery && cursor);
        assert.deepEqual(
          rows.map((r) => r.kind),
          expected.map(() => "cut"),
        );
        assert.deepEqual(
          rows.map((r) => r.projectAtUs),
          expected,
        );
        return hash(Buffer.from(JSON.stringify(rows)));
      };
      const waveformRange = { startUs: durationUs - 250000, endUs: durationUs };
      const windowStart = seconds * 48000 - 12000;
      const expectedBuckets =
        values.query === "waveform"
          ? Array.from({ length: rowsPerQuery }, (_, bucket) => {
              const gridStart = windowStart + bucket * 48;
              return {
                gridStart,
                sampleRange: { start: gridStart, end: gridStart + 48 },
                partial: false,
                channels: [0, 1].map((channel) => {
                  // The last 100ms occurrence begins after 150ms of authored empty space.
                  const samples = Array.from({ length: 48 }, (_, i) => {
                    const local = bucket * 48 + i - 7200;
                    return local < 0 ? 0 : sample(0, local, channel) / 32768;
                  });
                  return {
                    min: Math.min(...samples),
                    max: Math.max(...samples),
                    rms: Math.sqrt(
                      samples.reduce((sum, value) => sum + value * value, 0) / samples.length,
                    ),
                  };
                }),
              };
            })
          : undefined;
      const readWaveform = async () => {
        const params = {
          projectId,
          revisionId,
          range: waveformRange,
          bucketFrames: 48,
          format: "json",
        };
        let delivered;
        const ready = await poll(
          async () => {
            delivered = await service.mcp.callTool({ name: "waveform.get", arguments: params });
            assert.equal(delivered.structuredContent?.ok, true);
            trial.trace.push({
              operation: "waveform.get",
              transport: "mcp",
              state: delivered.structuredContent.data.state,
            });
            return delivered.structuredContent.data;
          },
          (value) => value.state === "ready",
          "waveform delivery",
        );
        assert.equal(delivered.content.length, 2);
        assert.equal(delivered.content[1].type, "text");
        const text = delivered.content[1].text,
          document = JSON.parse(text);
        assert.equal(document.domain, "project");
        assert.equal(document.projectId, projectId);
        assert.equal(document.revisionId, revisionId);
        assert.deepEqual(document.range, waveformRange);
        assert.deepEqual(document.sampleRange, { start: windowStart, end: seconds * 48000 });
        assert.equal(document.sampleRate, 48000);
        assert.equal(document.channels, 2);
        assert.equal(document.bucketFrames, 48);
        assert.deepEqual(document.buckets, expectedBuckets);
        assert.equal(ready.published.waveform.bytes, Buffer.byteLength(text));
        if (!trial.waveform) {
          const file = `waveform-${report.cases.length}-${seconds}.json`;
          await writeFile(join(out, file), text);
          trial.waveform = {
            file,
            receipt: ready,
            buckets: document.buckets.length,
            measurementSha256: hash(
              Buffer.from(JSON.stringify(document.buckets.map((row) => row.channels))),
            ),
          };
        }
        return hash(Buffer.from(text));
      };
      const read = values.query === "waveform" ? readWaveform : readTimeline;
      const coldAt = performance.now();
      trial.rowsSha256 = await read();
      trial.coldMs = performance.now() - coldAt;
      for (let repeat = 0; repeat < report.controls.repeats; repeat++) {
        const at = performance.now();
        assert.equal(await read(), trial.rowsSha256);
        trial.queryMs.push(performance.now() - at);
      }
      if (values.query === "waveform") {
        trial.queryP95Ms = [...trial.queryMs].sort((a, b) => a - b)[
          Math.ceil(trial.queryMs.length * 0.95) - 1
        ];
        assert.ok(
          trial.queryP95Ms <= 250,
          "Cached250-row inspection exceeded unchanged250ms p95 budget",
        );
      }
      stopped = true;
      await sampling;
      if (sampleError) throw sampleError;
      trial.sampledPeakBytes = Math.max(...trial.samples.map((s) => s.bytes));
      trial.sampledGrowthBytes = Math.max(0, trial.sampledPeakBytes - trial.baselineBytes);
      assert.ok(
        trial.samples.length >= 10,
        "Not enough resident samples to assess the query workload",
      );
      assert.ok(trial.sampledGrowthBytes > 0, "Query allocation growth was not observable");
      succeeded = true;
    } finally {
      stopped = true;
      if (sampling) await sampling;
      try {
        await service.stop();
      } finally {
        await save();
        if (succeeded) await rm(home, { recursive: true });
      }
    }
  }
  const cohort = (seconds, field) =>
    median(report.cases.filter((c) => c.seconds === seconds).map((c) => c[field]));
  report.comparison = {
    twoHourMedianPeakBytes: cohort(7200, "sampledPeakBytes"),
    fourHourMedianPeakBytes: cohort(14400, "sampledPeakBytes"),
    twoHourMedianGrowthBytes: cohort(7200, "sampledGrowthBytes"),
    fourHourMedianGrowthBytes: cohort(14400, "sampledGrowthBytes"),
  };
  report.comparison.peakRatio =
    report.comparison.fourHourMedianPeakBytes / report.comparison.twoHourMedianPeakBytes;
  report.comparison.growthRatio =
    report.comparison.fourHourMedianGrowthBytes / report.comparison.twoHourMedianGrowthBytes;
  report.passed = report.comparison.peakRatio < 2 && report.comparison.growthRatio < 2;
  await save();
  assert.ok(
    report.passed,
    "Doubling timeline duration doubled observed bounded-query memory; retain report and profile",
  );
} catch (error) {
  report.error = { message: error.message, stack: error.stack };
  throw error;
} finally {
  await save();
}
console.log(out);
