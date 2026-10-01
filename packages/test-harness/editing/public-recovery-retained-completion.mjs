import assert from "node:assert/strict";
import { appendFile, cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { ControllerJourneyService } from "./controller-journey-service.mjs";
import { hash, poll } from "./source-evidence-fixture.mjs";
const { values } = parseArgs({
  options: Object.fromEntries(
    ["out", "source-home", "executable", "native", "video"].map((name) => [
      name,
      { type: "string" },
    ]),
  ),
});
for (const name of ["out", "source-home", "executable", "native", "video"])
  assert.ok(values[name], name);
const out = resolve(values.out),
  home = join(out, "home");
await mkdir(out);
await cp(resolve(values["source-home"]), home, { recursive: true });
const recordings = join(home, "library/recordings");
const [recordingId] = await readdir(recordings);
const journal = join(recordings, recordingId, "source/capture.journal.jsonl");
const original = await readFile(journal, "utf8");
const records = original
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));
const completion = { state: "complete", durationUs: 2000000 };
await appendFile(
  journal,
  JSON.stringify({ sequence: records.at(-1).sequence + 1, event: "finished", data: completion }) +
    '\n{"torn":',
);
const journalHash = hash(await readFile(journal));
const report = {
  passed: false,
  trace: [],
  exchanges: [],
  fixture: [],
  originalCompletion: completion,
};
const service = new ControllerJourneyService(home, report, {
  ...Object.fromEntries(
    ["executable", "native", "video"].map((name) => [name, resolve(values[name])]),
  ),
  evidence: join(out, "native"),
});
try {
  await service.start();
  const take = await poll(
    () => service.call("recording.get", { recordingId }),
    (value) =>
      value.sourceAdmissions.length === 2 &&
      value.sourceAdmissions.every((source) => ["ready", "failed"].includes(source.job?.state)),
    "recovery settles",
  );
  report.take = take;
  for (const admission of take.sourceAdmissions)
    assert.equal(admission.job.state, "ready", JSON.stringify(admission));
  const primary = take.sourceAdmissions.find((source) => source.kind === "primary");
  assert.notEqual(primary.publication.source.sourceDurationUs, completion.durationUs);
  const acquired = await service.call("acquisition.get", { acquisitionId: primary.acquisitionId });
  report.acquired = acquired;
  assert.deepEqual(acquired.evidence.receipt.completion, {
    ...completion,
    sequence: records.at(-1).sequence + 1,
  });
  assert.equal(acquired.evidence.receipt.verifiedSourceAuthority, undefined);
  assert.equal(hash(await readFile(journal)), journalHash);
  report.passed = true;
} finally {
  report.logs = service.logs;
  await service.stop();
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ passed: report.passed, out }));
