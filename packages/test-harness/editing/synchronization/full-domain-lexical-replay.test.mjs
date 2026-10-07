import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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

test("refuses a full-domain lexical protocol with a changed anchor rule", async (t) => {
  const { replayFullDomainLexicalScout } = await import("./full-domain-lexical-replay.mjs");
  const directory = await mkdtemp(join(tmpdir(), "yap-full-domain-lexical-protocol-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await cp(dirname(evidence), directory, { recursive: true });
  const protocolPath = join(directory, "protocol.json");
  const reportPath = join(directory, "report.json");
  const protocol = JSON.parse(await readFile(protocolPath, "utf8"));
  protocol.anchorRule.minimumWords = 4;
  const protocolBytes = `${JSON.stringify(protocol, null, 2)}\n`;
  await writeFile(protocolPath, protocolBytes);
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  report.protocolSha256 = createHash("sha256").update(protocolBytes).digest("hex");
  await writeFile(reportPath, `${JSON.stringify(report)}\n`);
  await assert.rejects(
    replayFullDomainLexicalScout(reportPath),
    /anchor rule|minimumWords|protocol/i,
  );
});
