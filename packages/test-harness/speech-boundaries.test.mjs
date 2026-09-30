import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("redraw preserves an absolute mark and refuses incompatible reuse before writing", () => {
  const directory = mkdtempSync(join(tmpdir(), "speech-marks-"));
  try {
    let fixture = join(directory, "fixture");
    const out = join(directory, "panels");
    mkdirSync(fixture);
    // Synthetic silence supplies rendering input only; the numeric annotation is
    // the retained workbench scenario, not a new audible ground-truth claim.
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "anullsrc=r=16000:cl=mono",
      "-t",
      "8",
      "-c:a",
      "pcm_s16le",
      join(fixture, "narration.mov"),
    ]);
    let journal = join(fixture, "capture.journal.jsonl");
    writeFileSync(
      journal,
      JSON.stringify({ event: "trackStarted", data: { role: "narration", firstSourceUs: 48675 } }) +
        "\n",
    );
    const transcript = join(directory, "transcript.json");
    const word = {
      id: "w6",
      type: "word",
      text: "workbench.",
      partial: false,
      sourceRange: { startUs: 4368675, endUs: 5648675 },
    };
    const saveWord = () => writeFileSync(transcript, JSON.stringify([word]));
    saveWord();
    const run = (extra = []) =>
      spawnSync(
        process.execPath,
        [
          new URL("./speech-boundaries.mjs", import.meta.url).pathname,
          "--fixture",
          fixture,
          "--transcript",
          transcript,
          "--out",
          out,
          "--panels",
          "2",
          ...extra,
        ],
        { encoding: "utf8", timeout: 10000 },
      );
    const success = () => {
      const result = run();
      assert.equal(result.status, 0, result.stderr);
    };
    success();
    const marksPath = join(out, "marks.json"),
      panelPath = join(out, "sheet-0.png");
    const initial = JSON.parse(readFileSync(marksPath));
    initial.boundaries.find((v) => v.side === "end").markedOffsetMs = -5;
    initial.markedBy = "Retained numeric regression; no new audition";
    writeFileSync(marksPath, JSON.stringify(initial));
    const originalPanel = readFileSync(panelPath);
    success();
    const unchanged = JSON.parse(readFileSync(marksPath));
    assert.equal(unchanged.boundaries.find((v) => v.side === "end").markedOffsetMs, -5);
    assert.deepEqual(readFileSync(panelPath), originalPanel);
    word.sourceRange.endUs = 5088675;
    saveWord();
    success();
    const moved = JSON.parse(readFileSync(marksPath));
    const end = moved.boundaries.find((v) => v.side === "end");
    assert.equal(end.markedOffsetMs, 555);
    assert.equal(end.reportedUs + end.markedOffsetMs * 1000, 5643675);
    assert.equal(moved.boundaries.find((v) => v.side === "start").markedOffsetMs, null);
    assert.equal(moved.markedBy, initial.markedBy);
    const relocated = join(directory, "relocated");
    cpSync(fixture, relocated, { recursive: true });
    fixture = relocated;
    journal = join(fixture, "capture.journal.jsonl");
    success();
    assert.equal(
      JSON.parse(readFileSync(marksPath)).boundaries.find((v) => v.side === "end").markedOffsetMs,
      555,
    );
    let retained = [readFileSync(marksPath), readFileSync(panelPath)];
    const refusal = () => {
      const result = run();
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /annotation|marked boundary/i);
      assert.deepEqual([readFileSync(marksPath), readFileSync(panelPath)], retained);
    };
    word.text = "different";
    saveWord();
    refusal();
    word.text = "workbench.";
    saveWord();
    writeFileSync(
      journal,
      JSON.stringify({ event: "trackStarted", data: { role: "narration", firstSourceUs: 0 } }) +
        "\n",
    );
    refusal();
    writeFileSync(
      journal,
      JSON.stringify({ event: "trackStarted", data: { role: "narration", firstSourceUs: 48675 } }) +
        "\n",
    );
    const source = join(fixture, "narration.mov"),
      bytes = readFileSync(source);
    writeFileSync(source, Buffer.concat([bytes, Buffer.from("changed")]));
    refusal();
    writeFileSync(source, bytes);
    writeFileSync(transcript, "[]");
    refusal();
    saveWord();
    const legacy = JSON.parse(readFileSync(marksPath));
    delete legacy.narrationSha256;
    delete legacy.originUs;
    writeFileSync(marksPath, JSON.stringify(legacy));
    retained = [readFileSync(marksPath), readFileSync(panelPath)];
    refusal();
    const scored = run(["--score"]);
    assert.equal(scored.status, 0, scored.stderr);
    assert.equal(JSON.parse(readFileSync(join(out, "scored.json"))).medianErrorMs, 555);
    assert.deepEqual([readFileSync(marksPath), readFileSync(panelPath)], retained);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
