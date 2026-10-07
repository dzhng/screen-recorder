import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lexicalCandidates } from "./lexical.mjs";

const words = (text) => text.split(" ").map((text) => ({ text }));
const window = (name, originUs, text) => ({ name, originUs, words: words(text) });

test("independently observed unique phrases retain their separate source clocks", () => {
  const result = lexicalCandidates(
    [window("left", 240000000, "These five spoken words matter today")],
    [window("right", 1200000000, "these five spoken words matter tomorrow")],
  );
  assert.deepEqual(result.unique, [
    {
      phrase: ["these", "five", "spoken", "words", "matter"],
      left: { window: "left", originUs: 240000000, wordIndex: 0 },
      right: { window: "right", originUs: 1200000000, wordIndex: 0 },
    },
  ]);
  assert.deepEqual(result.ambiguous, []);
});

test("a repeated utterance retains all competing occurrences without choosing one", () => {
  const text = "these five spoken words matter";
  const result = lexicalCandidates(
    [window("first", 0, text), window("repeat", 240000000, text)],
    [window("other", 0, text)],
  );
  assert.deepEqual(result.unique, []);
  assert.deepEqual(result.ambiguous, [
    {
      phrase: text.split(" "),
      left: [
        { window: "first", originUs: 0, wordIndex: 0 },
        { window: "repeat", originUs: 240000000, wordIndex: 0 },
      ],
      right: [{ window: "other", originUs: 0, wordIndex: 0 }],
    },
  ]);
});

test("missing speech cannot be manufactured by joining selected windows", () => {
  assert.deepEqual(
    lexicalCandidates(
      [window("first", 0, "these five spoken"), window("second", 240000000, "words matter")],
      [window("other", 0, "these five spoken words matter")],
    ),
    { unique: [], ambiguous: [] },
  );
  assert.deepEqual(
    lexicalCandidates(
      [window("silent", 0, "")],
      [window("speech", 0, "these five spoken words matter")],
    ),
    { unique: [], ambiguous: [] },
  );
});

test("outer replay preserves frozen observations and refuses a changed model identity", () => {
  const scratch = mkdtempSync(join(tmpdir(), "yap-lexical-test-"));
  const bank = new URL(
    "../../../../specs/done/video-editing-feedback/assets/20-synchronization/lexical/",
    import.meta.url,
  );
  const fixtures = new URL(
    "../../../../fixtures/video-editing-feedback/synchronization/",
    import.meta.url,
  ).pathname;
  const runner = new URL("lexical-scout.mjs", import.meta.url).pathname;
  const invoke = (capture, out) =>
    spawnSync(
      process.execPath,
      [runner, "--fixtures", fixtures, "--out", out, "--capture", capture],
      { encoding: "utf8" },
    );
  try {
    const replay = invoke(bank.pathname, join(scratch, "replay"));
    assert.equal(replay.status, 0, replay.stderr);
    assert.deepEqual(
      JSON.parse(readFileSync(join(scratch, "replay/report.json"))),
      JSON.parse(readFileSync(new URL("report.json", bank))),
    );
    const changed = JSON.parse(readFileSync(new URL("report.json", bank)));
    for (const row of changed.observations)
      copyFileSync(new URL(row.name + ".jsonl", bank), join(scratch, row.name + ".jsonl"));
    changed.models.files[0].sha256 = "0".repeat(64);
    writeFileSync(join(scratch, "report.json"), JSON.stringify(changed));
    const refused = invoke(scratch, join(scratch, "refused"));
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /Capture report differs from the frozen research identity/);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
