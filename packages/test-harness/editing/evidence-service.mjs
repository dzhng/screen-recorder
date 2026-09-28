import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { startProjectService } from "../../../apps/service/dist/project-service.js";
import { mediaWorker } from "../../../apps/service/dist/worker.js";
import { parakeetModel } from "../../core/dist/speech-models.js";

// Only ASR output is frozen. Public admission, native probing and shared transcript ingestion are real.
const fixture = JSON.parse(await readFile(process.argv[3], "utf8"));
const native = mediaWorker();
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const observations = [];
const worker = async (operation, params, options) => {
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
    (source) => source.sha256 === sha256 && source.streamId === params.track.streamId,
  );
  assert.ok(expected, "Frozen ASR received an unregistered byte source or stream");
  assert.equal(params.track.sourceOffsetUs, expected.sourceOffsetUs);
  assert.deepEqual(params.track.available, expected.available);
  assert.deepEqual(params.models.files, parakeetModel.files);
  assert.equal(
    await realpath(params.models.directory),
    await realpath(
      join(
        process.argv[2],
        "library/models",
        parakeetModel.name,
        parakeetModel.revision,
        parakeetModel.folderName,
      ),
    ),
  );
  const raw = await readFile(expected.rawFile);
  assert.equal(hash(raw), expected.rawSha256);
  const retained = JSON.parse(await readFile(expected.receiptFile, "utf8")).data;
  assert.equal(retained.output.sha256, hash(raw));
  assert.deepEqual(
    retained.segments.map((segment) => segment.source),
    expected.available,
  );
  await writeFile(params.output, raw);
  options.signal.throwIfAborted();
  observations.push({
    sourceSha256: sha256,
    streamId: params.track.streamId,
    sourceOffsetUs: params.track.sourceOffsetUs,
    available: params.track.available,
    rawSha256: hash(raw),
    output: params.output,
  });
  await writeFile(
    fixture.observationsFile,
    JSON.stringify(
      {
        boundary: "Frozen native ASR output; actual shared ingestion and public queries",
        calls: observations,
      },
      null,
      2,
    ),
  );
  return {
    ok: true,
    data: { ...retained, output: { file: params.output, bytes: raw.length, sha256: hash(raw) } },
  };
};
try {
  const service = await startProjectService({ home: process.argv[2], worker });
  let closing;
  const close = () => (closing ??= service.close().then(() => process.disconnect()));
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
