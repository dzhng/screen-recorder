import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, realpath, writeFile } from "node:fs/promises";
import { appendFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { historicalWholeSupportRecords } from "./speech-parity-records.mjs";
import { portHistoricalSpeechRaw } from "../speech/reference-raw.mjs";
import { TranscriptStore } from "../../../packages/core/dist/transcript.js";
import { dirname, join } from "node:path";
import { startProjectService } from "../../../apps/service/dist/project-service.js";
import { jsonWorker, mediaWorker } from "../../../apps/service/dist/worker.js";
import { parakeetModel } from "../../core/dist/models.js";
import { isDeepStrictEqual } from "node:util";
import { installServiceProfiler } from "./service-cpu-profile.mjs";

// Public admission, native probing and shared transcript ingestion are real in both fixture modes.
const fixture = JSON.parse(await readFile(process.argv[3], "utf8"));
if (fixture.metadataReadsFile) {
  const prepare = DatabaseSync.prototype.prepare;
  DatabaseSync.prototype.prepare = function (sql, ...options) {
    const statement = prepare.call(this, sql, ...options);
    const owner = sql.startsWith("SELECT metadata FROM assets")
      ? "asset.header"
      : sql.startsWith("SELECT value FROM asset_segments")
        ? "asset.segments"
        : sql.startsWith("SELECT metadata FROM acquisitions")
          ? "acquisition"
          : null;
    if (owner) {
      const method = owner === "asset.segments" ? "all" : "get";
      const read = statement[method];
      statement[method] = function (...params) {
        const result = read.apply(this, params);
        appendFileSync(
          fixture.metadataReadsFile,
          JSON.stringify({ owner, rows: Array.isArray(result) ? result.length : result ? 1 : 0 }) +
            "\n",
        );
        return result;
      };
    }
    return statement;
  };
}
const stopProfiler = fixture.cpuProfile ? installServiceProfiler(fixture.cpuProfile) : undefined;
if (fixture.readsFile) {
  const wordRecords = TranscriptStore.prototype.wordRecords;
  TranscriptStore.prototype.wordRecords = function (identity, query) {
    const rows = wordRecords.call(this, identity, query);
    appendFileSync(
      fixture.readsFile,
      JSON.stringify({
        sourceId: identity.sourceId,
        generation: identity.generation,
        query,
        rows: rows.length,
      }) + "\n",
    );
    return rows;
  };
}
const native = fixture.existingModels
  ? jsonWorker({
      executable: "/usr/bin/sandbox-exec",
      args: [
        "-p",
        `(version 1)(allow default)(deny network*)(deny file-write* (subpath ${JSON.stringify(dirname(fixture.existingModels.directory))}))`,
        process.env.YAP_NATIVE,
      ],
    })
  : mediaWorker();
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const observations = fixture.existingModels
  ? await readFile(fixture.observationsFile, "utf8").then(
      (bytes) => JSON.parse(bytes).calls,
      (error) => {
        if (error.code !== "ENOENT") throw error;
        return [];
      },
    )
  : [];
let observationWrites = Promise.resolve();
function persistObservations() {
  observationWrites = observationWrites.then(() =>
    writeFile(
      fixture.observationsFile,
      JSON.stringify(
        {
          boundary: fixture.existingModels
            ? "Actual native inference with declared scratch readiness and existing read-only prepared files"
            : "Frozen native ASR output; actual shared ingestion and public queries",
          calls: observations,
        },
        null,
        2,
      ),
    ),
  );
  return observationWrites;
}
const worker = async (operation, params, options) => {
  if (fixture.allowedOperations) {
    assert.ok(
      fixture.allowedOperations.includes(operation),
      `Unexpected native work: ${operation}`,
    );
    appendFileSync(fixture.operationsFile, JSON.stringify({ operation }) + "\n");
  }
  if (operation !== "speech.transcribe") return native(operation, params, options);
  options.signal.throwIfAborted();
  assert.deepEqual(Object.keys(params.track).sort(), [
    "available",
    "source",
    "sourceOffsetUs",
    "streamId",
  ]);
  const sha256 = hash(await readFile(params.track.source));
  const expected = fixture.sources.find(
    (source) =>
      source.sha256 === sha256 &&
      source.streamId === params.track.streamId &&
      isDeepStrictEqual(source.available, params.track.available),
  );
  assert.ok(expected, "ASR received an unregistered byte source or stream");
  assert.equal(params.track.sourceOffsetUs, expected.sourceOffsetUs);
  assert.deepEqual(params.track.available, expected.available);
  assert.deepEqual(params.models.files, parakeetModel.files);
  assert.equal(
    await realpath(params.models.directory),
    await realpath(
      fixture.existingModels?.directory ??
        join(
          process.argv[2],
          "library/models",
          parakeetModel.name,
          parakeetModel.revision,
          parakeetModel.folderName,
        ),
    ),
  );
  if (fixture.existingModels) {
    assert.ok(
      observations.length < 2,
      "Actual parity permits initial and replacement inference attempts only",
    );
    const attempt = {
      request: structuredClone(params),
      sourceSha256: sha256,
      output: params.output,
      state: "reserved",
      nativeInvoked: false,
    };
    observations.push(attempt);
    const rawFile = join(fixture.rawOutputsDirectory, `native-${observations.length}.jsonl`);
    try {
      await persistObservations();
      attempt.nativeInvoked = true;
      attempt.result = await native(operation, params, options);
      if (attempt.result.ok) {
        const raw = await readFile(params.output);
        await writeFile(rawFile, raw, { flag: "wx" });
        attempt.rawFile = rawFile;
        attempt.rawSha256 = hash(raw);
        const baselineBytes = await readFile(expected.receiptFile);
        assert.equal(hash(baselineBytes), expected.receiptSha256);
        const baseline = JSON.parse(baselineBytes).data;
        assert.equal(attempt.result.data.output.file, params.output);
        assert.equal(attempt.result.data.output.bytes, raw.length);
        assert.equal(attempt.result.data.output.sha256, attempt.rawSha256);
        assert.deepEqual(attempt.result.data.engine, baseline.engine);
        assert.deepEqual(
          attempt.result.data.segments.map(({ owned, ...segment }) => {
            assert.deepEqual(owned, segment.source);
            return segment;
          }),
          baseline.segments,
        );
        assert.deepEqual(
          historicalWholeSupportRecords(raw),
          historicalWholeSupportRecords(await readFile(expected.rawFile)),
        );
        assert.equal(attempt.result.data.wordCount, baseline.wordCount);
      }
      attempt.state = attempt.result.ok ? "ready" : "refused";
      return attempt.result;
    } catch (error) {
      attempt.state = "failed";
      attempt.error = {
        name: error.name,
        code: error.code,
        message: error.message,
        stack: error.stack,
      };
      throw error;
    } finally {
      await persistObservations();
    }
  }
  const raw = await readFile(expected.rawFile);
  assert.equal(hash(raw), expected.rawSha256);
  const receipt = await readFile(expected.receiptFile);
  if (expected.receiptSha256) assert.equal(hash(receipt), expected.receiptSha256);
  const retained = JSON.parse(receipt).data;
  assert.equal(retained.output.sha256, hash(raw));
  assert.deepEqual(
    retained.segments.map((segment) => segment.source),
    expected.available,
  );
  const admitted = portHistoricalSpeechRaw(raw, {
    execution: params.execution,
    available: retained.segments.map((segment) => segment.source),
  });
  await writeFile(params.output, admitted.body);
  options.signal.throwIfAborted();
  const data = {
    ...retained,
    execution: params.execution,
    available: retained.segments.map((segment) => segment.source),
    segments: retained.segments.map((segment) => ({ ...segment, owned: segment.source })),
    referenceReplay: admitted.referenceReplay,
    output: { file: params.output, bytes: admitted.body.length, sha256: admitted.sha256 },
  };
  observations.push({
    request: params,
    receipt: data,
    sourceSha256: sha256,
    streamId: params.track.streamId,
    sourceOffsetUs: params.track.sourceOffsetUs,
    available: params.track.available,
    rawSha256: hash(raw),
    output: params.output,
  });
  await persistObservations();
  return {
    ok: true,
    data,
  };
};
try {
  const service = await startProjectService({ home: process.argv[2], worker });
  let closing;
  const close = () =>
    (closing ??= service
      .close()
      .finally(() => stopProfiler?.())
      .then(() => process.disconnect()));
  process.on("message", (message) => {
    if (message === "close") void close();
  });
  process.on("disconnect", () => {
    void close();
  });
  process.send({ socketPath: service.socketPath });
} catch (error) {
  process.send({ error: { code: error.code, message: error.message } });
  process.disconnect();
  process.exitCode = 1;
}
