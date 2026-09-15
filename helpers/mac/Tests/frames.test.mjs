import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const executable =
  process.env.SCREENREC_NATIVE ??
  fileURLToPath(new URL("../.build/debug/screenrec-native", import.meta.url));

test("frame worker returns actual sample pixels and survives invalid requests", () => {
  const directory = mkdtempSync(join(tmpdir(), "screenrec-frame-wire-"));
  try {
    const source = join(directory, "source.mov");
    const output = join(directory, "frame.png");
    const fixture = spawnSync(
      "ffmpeg",
      [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "testsrc2=size=160x90:rate=10:duration=1",
        "-an",
        "-c:v",
        "libx264",
        source,
      ],
      { encoding: "utf8", timeout: 15000 },
    );
    assert.equal(fixture.status, 0, fixture.stderr);
    const before = readFileSync(source);
    const params = {
      source,
      output,
      atSourceUs: 150000,
      kept: { startUs: 0, endUs: 1000000 },
      maxLongEdge: 80,
    };
    const requests = [
      { ...params, kept: { ...params.kept, extra: true } },
      { ...params, atSourceUs: true },
      { ...params, crop: { x: 0, y: 0, width: 20, height: 20, extra: true } },
      { ...params, output: source },
      { ...params, kept: { startUs: 110000, endUs: 190000 } },
      params,
    ].map((params, id) => ({ id: String(id), operation: "media.frame", params }));
    const run = spawnSync(executable, [], {
      input: requests.map(JSON.stringify).join("\n") + "\n",
      encoding: "utf8",
      timeout: 15000,
    });
    assert.equal(run.status, 0, run.stderr);
    const replies = run.stdout.trim().split("\n").map(JSON.parse);
    for (const [index, code] of [
      "INVALID_REQUEST",
      "INVALID_REQUEST",
      "INVALID_REQUEST",
      "INVALID_OUTPUT",
      "UNAVAILABLE",
    ].entries()) {
      assert.equal(replies[index].id, String(index));
      assert.equal(replies[index].ok, false);
      assert.equal(replies[index].error.code, code);
    }
    const frame = replies[5];
    assert.equal(frame.ok, true);
    assert.equal(frame.data.actualSourceUs, 100000);
    assert.equal(frame.data.distanceUs, 50000);
    assert.equal(frame.data.width, 80);
    assert.equal(frame.data.height, 45);
    const png = readFileSync(output);
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(png.readUInt32BE(16), 80);
    assert.equal(png.readUInt32BE(20), 45);
    assert.equal(frame.data.bytes, png.length);
    assert.deepEqual(readFileSync(source), before);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("frame worker draws the supplied pointer and trail, or nothing at all", () => {
  const directory = mkdtempSync(join(tmpdir(), "screenrec-frame-overlay-"));
  try {
    const source = join(directory, "source.mov");
    const fixture = spawnSync(
      "ffmpeg",
      [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "testsrc2=size=160x90:rate=10:duration=1",
        "-an",
        "-c:v",
        "libx264",
        source,
      ],
      { encoding: "utf8", timeout: 15000 },
    );
    assert.equal(fixture.status, 0, fixture.stderr);
    const before = readFileSync(source);
    const params = {
      source,
      atSourceUs: 900000,
      kept: { startUs: 0, endUs: 1000000 },
    };
    const trail = [
      [
        { atSourceUs: 500000, x: 20, y: 70 },
        { atSourceUs: 700000, x: 60, y: 70 },
        { atSourceUs: 900000, x: 100, y: 70 },
      ],
    ];
    const overlay = {
      trail,
      trailUs: 2000000,
      pointer: { atSourceUs: 900000, x: 100, y: 70 },
    };
    const clean = join(directory, "clean.png");
    const drawn = join(directory, "drawn.png");
    const requests = [
      { ...params, output: clean },
      { ...params, output: drawn, overlay },
      {
        ...params,
        output: join(directory, "a.png"),
        overlay: { trail, trailUs: 2000000, extra: 1 },
      },
      {
        ...params,
        output: join(directory, "b.png"),
        overlay: { trail: [[{ atSourceUs: 500000, x: 20, y: 70, extra: 1 }]], trailUs: 2000000 },
      },
      {
        ...params,
        output: join(directory, "c.png"),
        overlay: { trail: [[{ atSourceUs: 500000, x: 161, y: 70 }]], trailUs: 2000000 },
      },
    ].map((params, id) => ({ id: String(id), operation: "media.frame", params }));
    const run = spawnSync(executable, [], {
      input: requests.map(JSON.stringify).join("\n") + "\n",
      encoding: "utf8",
      timeout: 15000,
    });
    assert.equal(run.status, 0, run.stderr);
    const replies = run.stdout.trim().split("\n").map(JSON.parse);

    assert.equal(replies[0].ok, true, run.stdout);
    assert.equal(replies[0].data.overlay, undefined);
    assert.equal(replies[1].ok, true, run.stdout);
    assert.deepEqual(replies[1].data.overlay, {
      trailPoints: 3,
      trailStartUs: 500000,
      trailEndUs: 900000,
      pointerSourceUs: 900000,
    });
    assert.equal(replies[1].data.width, 160);
    assert.notDeepEqual(readFileSync(drawn), readFileSync(clean));
    assert.equal(replies[1].data.bytes, readFileSync(drawn).length);

    assert.equal(replies[2].error.code, "INVALID_REQUEST");
    assert.equal(replies[3].error.code, "INVALID_REQUEST");
    assert.equal(replies[4].error.code, "INVALID_RANGE");
    assert.deepEqual(readFileSync(source), before);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
