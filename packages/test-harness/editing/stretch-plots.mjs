import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";

// FFmpeg's scientific signal plots: frequency axes and identical join-centered windows.
const out = resolve(process.argv[2]);
const run = (args) => execFileSync("ffmpeg", ["-v", "error", ...args], { timeout: 30000 });
const cases = [["input", 1], ...[0.8, 0.9, 1, 1.25].map((speed) => [String(speed), speed])];
for (const [label, speed] of cases) {
  const tone = label === "input" ? "tone-input.wav" : `tone-${label}-native.wav`;
  run([
    "-i",
    join(out, tone),
    "-lavfi",
    `showspectrumpic=s=840x360:legend=1:start=300:stop=600:scale=log:drange=40:limit=-10`,
    "-frames:v",
    "1",
    join(out, `spectrum-${label}.png`),
  ]);
  const local = label === "input" ? "local-phrase-input.wav" : `local-phrase-${label}-context.wav`;
  const end = label === "input" ? 2 : 0.5 + 1.5 / speed;
  for (const [side, at] of [
    ["left", 0.5],
    ["right", end],
  ]) {
    run([
      "-i",
      join(out, local),
      "-lavfi",
      `atrim=start=${at - 0.1}:end=${at + 0.1},showwavespic=s=450x160:colors=white:scale=lin,drawgrid=w=225:h=160:t=1:c=red`,
      "-frames:v",
      "1",
      join(out, `join-${label}-${side}.png`),
    ]);
  }
}
function stack(names, filter, output) {
  run([
    ...names.flatMap((name) => ["-i", join(out, name)]),
    "-filter_complex",
    filter,
    "-frames:v",
    "1",
    join(out, output),
  ]);
}
stack(
  cases.map(([label]) => `spectrum-${label}.png`),
  "vstack=inputs=5",
  "tone-spectrum.png",
);
const waveNames = cases.flatMap(([label]) =>
  ["left", "right"].map((side) => `join-${label}-${side}.png`),
);
stack(
  waveNames,
  "[0:v][1:v]hstack[a];[2:v][3:v]hstack[b];[4:v][5:v]hstack[c];[6:v][7:v]hstack[d];[8:v][9:v]hstack[e];[a][b][c][d][e]vstack=inputs=5",
  "join-waveforms.png",
);
console.log(join(out, "tone-spectrum.png"));
console.log(join(out, "join-waveforms.png"));
