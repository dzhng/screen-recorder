import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const root = new URL("../../../../", import.meta.url).pathname;
const evidence = join(
  root,
  "specs/video-editing-feedback/assets/20-synchronization/full-domain-lexical/report.json",
);

test("replays the refused full-domain lexical synchronization scout", async () => {
  const { replayFullDomainLexicalScout } = await import("./full-domain-lexical-replay.mjs");
  const result = await replayFullDomainLexicalScout(evidence);
  assert.deepEqual(result, {
    status: "refused",
    promotion: false,
    sourceCount: 4,
    crossParticipantAnchorCount: 0,
    longestCrossParticipantNgram: 4,
  });
});

test("refuses a full-domain lexical report whose refusal was edited", async (t) => {
  const { replayFullDomainLexicalScout } = await import("./full-domain-lexical-replay.mjs");
  const directory = await mkdtemp(join(tmpdir(), "yap-full-domain-lexical-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await cp(dirname(evidence), directory, { recursive: true });
  const reportPath = join(directory, "report.json");
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  report.status = "accepted";
  await writeFile(reportPath, `${JSON.stringify(report)}\n`);
  await assert.rejects(replayFullDomainLexicalScout(reportPath), /status|promotion|refused/i);
});
