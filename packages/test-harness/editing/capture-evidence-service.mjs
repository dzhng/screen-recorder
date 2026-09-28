import { appendFileSync } from "node:fs";
import { SourceEvidenceStore } from "../../core/dist/evidence.js";
import { startProjectService } from "../../../apps/service/dist/project-service.js";

// Observe real indexed reads without replacing results, clock mapping or storage ownership.
const pointRecords = SourceEvidenceStore.prototype.pointRecords;
SourceEvidenceStore.prototype.pointRecords = function (identity, index, range, after, limit) {
  const rows = pointRecords.call(this, identity, index, range, after, limit);
  appendFileSync(
    process.argv[3],
    JSON.stringify({
      identity: {
        owner: identity.owner,
        sourceId: identity.sourceId,
        generation: identity.generation,
      },
      index,
      range,
      after,
      limit,
      rows: rows.map((row) => ({ sourceUs: row.sourceUs, sequence: row.sequence })),
    }) + "\n",
  );
  return rows;
};
try {
  const service = await startProjectService({ home: process.argv[2] });
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
