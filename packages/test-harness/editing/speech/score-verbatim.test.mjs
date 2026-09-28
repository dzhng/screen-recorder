import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("candidate file seconds map to source marks; omitted and ambiguous edges cannot pass", () => {
  const folder = mkdtempSync(join(tmpdir(), "verbatim-score-"));
  const save = (name, value) => { const path = join(folder, name); writeFileSync(path, JSON.stringify(value)); return path; };
  try {
    const labels = save("labels.json", { narrationFileOriginUs: 750_000 });
    const marks = save("marks.json", { boundaries: [
      { id: "a", text: "uh", side: "start", reportedUs: 1_750_000, markedOffsetMs: 0 },
      { id: "b", text: "end", side: "end", reportedUs: 3_000_000, markedOffsetMs: null },
    ] });
    const score = (words) => {
      const candidate = save("candidate.json", { duration: 3, words });
      const run = spawnSync(process.execPath, [new URL("score-verbatim.mjs", import.meta.url).pathname, candidate, marks, labels], { encoding: "utf8" });
      assert.equal(run.status, 0, run.stderr);
      return JSON.parse(run.stdout);
    };
    const word = { word: "[uh]", start: 1, end: 1.3 };
    const aligned = score([word]);
    assert.equal(aligned.meetsTiming, true);
    assert.equal(aligned.medianErrorMs, 0);
    assert.equal(aligned.unmarked, 1);
    assert.equal(aligned.fullFillerRecall, null);
    assert.deepEqual(aligned.boundaries, [{ id: "a", side: "start", state: "matched", errorMs: 0, insideSpeech: false }]);
    assert.equal(score([]).boundaries[0].state, "missing");
    assert.equal(score([]).meetsTiming, false);
    assert.equal(score([word, word]).boundaries[0].state, "ambiguous");
    assert.equal(score([word, word]).meetsTiming, false);
    assert.equal(score([{ ...word, start: 1.4, end: 1.6 }]).medianErrorMs, 400);
    assert.equal(score([{ ...word, start: 1.4, end: 1.6 }]).meetsTiming, false);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
