import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { run } from "./source-evidence-fixture.mjs";
const out = resolve(process.argv[2]),
  report = JSON.parse(await readFile(join(out, "report.json"), "utf8"));
assert(report.passed);
const timings = [];
for (const cohort of report.cohorts)
  for (const movie of [cohort.full, ...(cohort.clipped ? [cohort.clipped] : [])]) {
    const probe = JSON.parse(
      (
        await run(
          "ffprobe",
          [
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_packets",
            "-show_streams",
            "-of",
            "json",
            movie.path,
          ],
          { maxBuffer: 8 * 1024 ** 2 },
        )
      ).stdout,
    );
    const stream = probe.streams[0],
      [numerator, denominator] = stream.time_base.split("/").map(BigInt);
    const exact = (value, microseconds, label) =>
      assert.equal(BigInt(value) * numerator * 1000000n, BigInt(microseconds) * denominator, label);
    assert.equal(probe.packets.length, movie.frames.length);
    exact(
      stream.duration_ts,
      movie.range.endUs - movie.range.startUs,
      "Encoded track duration changed",
    );
    for (const [i, packet] of probe.packets.entries()) {
      const frame = movie.frames[i],
        start = Math.max(frame.visibleRange.startUs, movie.range.startUs),
        end = Math.min(frame.visibleRange.endUs, movie.range.endUs);
      exact(packet.pts, start - movie.range.startUs, "Packet PTS changed");
      exact(packet.duration, end - start, "Packet duration changed");
    }
    timings.push({ cohort: cohort.name, label: movie.label, probe, passed: true });
  }
await writeFile(join(out, "packet-timing.json"), JSON.stringify(timings, null, 2));
console.log(
  JSON.stringify({
    passed: true,
    streams: timings.length,
    packets: timings.reduce((n, v) => n + v.probe.packets.length, 0),
  }),
);
