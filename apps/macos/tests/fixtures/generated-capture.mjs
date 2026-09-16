import assert from "node:assert/strict";

export const width = 1280,
  height = 800;
// A small deterministic raster font avoids depending on a font installation or ffmpeg drawtext.
const glyphs = {
  A: "0e11111f111111",
  B: "1e11111e11111e",
  C: "0f10101010100f",
  D: "1e11111111111e",
  E: "1f10101e10101f",
  F: "1f10101e101010",
  G: "0f10101711110f",
  H: "1111111f111111",
  I: "1f04040404041f",
  J: "0702020212120c",
  K: "11121418141211",
  L: "1010101010101f",
  M: "111b1515111111",
  N: "11191513111111",
  O: "0e11111111110e",
  P: "1e11111e101010",
  Q: "0e11111115120d",
  R: "1e11111e141211",
  S: "0f10100e01011e",
  T: "1f040404040404",
  U: "1111111111110e",
  V: "11111111110a04",
  W: "11111115151b11",
  X: "11110a040a1111",
  Y: "11110a04040404",
  Z: "1f01020408101f",
  0: "0e11131519110e",
  1: "040c040404040e",
  2: "0e11010204081f",
  3: "1e01010601011e",
  4: "02060a121f0202",
  5: "1f10101e01011e",
  6: "0e10101e11110e",
  7: "1f010204080808",
  8: "0e11110e11110e",
  9: "0e11110f01010e",
  " ": "00000000000000",
  ".": "00000000000606",
  ":": "00060600060600",
  "-": "0000001f000000",
  "/": "01020204080810",
};
export function raster(width, height) {
  const rgb = Buffer.alloc(width * height * 3);
  function rect(x, y, w, h, color) {
    for (let row = y; row < y + h; row++)
      for (let col = x; col < x + w; col++) {
        const at = (row * width + col) * 3;
        rgb[at] = color[0];
        rgb[at + 1] = color[1];
        rgb[at + 2] = color[2];
      }
  }
  function text(value, x, y, scale, color) {
    for (const [index, letter] of [...value].entries()) {
      assert.ok(glyphs[letter], `Missing fixture glyph ${letter}`);
      for (let row = 0; row < 7; row++) {
        const bits = parseInt(glyphs[letter].slice(row * 2, row * 2 + 2), 16);
        for (let col = 0; col < 5; col++)
          if (bits & (1 << (4 - col)))
            rect(x + index * 6 * scale + col * scale, y + row * scale, scale, scale, color);
      }
    }
  }
  return { rgb, rect, text };
}
export function page(changed) {
  const { rgb, rect, text } = raster(width, height);
  rect(0, 0, width, height, changed ? [24, 40, 58] : [239, 243, 248]);
  rect(0, 0, width, 80, [21, 34, 53]);
  rect(24, 23, 30, 30, [235, 108, 66]);
  text("LOCALHOST REVIEW", 75, 27, 3, [243, 246, 250]);
  text(changed ? "SCREEN B" : "SCREEN A", 1080, 29, 2, [111, 220, 198]);
  rect(0, 80, 220, 720, changed ? [32, 56, 73] : [255, 255, 255]);
  const nav = ["OVERVIEW", "PROJECTS", "BILLING", "SETTINGS"];
  nav.forEach((label, i) => {
    if (i === 2) rect(16, 217, 187, 44, [224, 236, 248]);
    text(label, 28, 119 + i * 56, 2, changed && i !== 2 ? [192, 213, 232] : [46, 72, 100]);
  });
  text(
    changed ? "DEPLOYMENT COMPLETE" : "BILLING SETTINGS",
    270,
    125,
    4,
    changed ? [240, 246, 250] : [31, 49, 70],
  );
  text("REVIEW THE PLAN BEFORE SHIPPING", 272, 177, 2, changed ? [150, 182, 203] : [93, 109, 130]);
  rect(270, 220, 920, 385, changed ? [39, 77, 89] : [255, 255, 255]);
  rect(320, 275, 350, 240, changed ? [74, 117, 114] : [238, 247, 241]);
  rect(725, 275, 410, 240, changed ? [73, 90, 127] : [239, 244, 253]);
  text(changed ? "LIVE PLAN" : "FREE PLAN", 356, 302, 3, [24, 62, 51]);
  text("0 USD", 388, 361, 5, changed ? [227, 245, 236] : [39, 88, 66]);
  text("FOR SMALL PROJECTS", 346, 410, 2, changed ? [225, 239, 231] : [73, 101, 87]);
  text("TEAM PLAN", 777, 303, 3, changed ? [230, 239, 254] : [34, 68, 115]);
  text("20 USD", 798, 362, 4, changed ? [230, 239, 254] : [34, 68, 115]);
  rect(780, 445, 290, 55, [36, 89, 153]);
  text("UPGRADE", 854, 464, 3, [250, 252, 255]);
  text("PLAN CHANGES APPLY NEXT MONTH", 321, 555, 2, changed ? [227, 239, 239] : [67, 86, 108]);
  rect(270, 650, 920, 90, changed ? [75, 109, 91] : [228, 238, 230]);
  text(changed ? "DEPLOYMENT IS LIVE" : "PREVIEW ENVIRONMENT", 300, 674, 3, [29, 65, 43]);
  for (let i = 0; i < 7; i++) rect(950 + i * 25, 718 - i * 6, 16, 12 + i * 6, [58, 131, 98]);
  return rgb;
}

/** Synthetic journal geometry and observations; never captures a screen or enables audio. */
export function journalRows({ sourceId, width, height, samples, pauses = [] }) {
  const rows = [
    {
      event: "header",
      data: {
        schemaVersion: 1,
        sessionID: sourceId,
        source: { kind: "window", windowID: 1 },
        width,
        height,
        microphone: false,
        systemAudio: false,
      },
    },
    { event: "origin", data: { hostUs: 1_000_000 } },
    {
      event: "geometry",
      data: {
        epoch: 1,
        hostUs: 1_000_000,
        sourceUs: 0,
        geometry: {
          outputWidth: width,
          outputHeight: height,
          contentRect: { x: 0, y: 0, width, height },
          contentScale: 1,
          scaleFactor: 1,
          screenRect: { x: 0, y: 0, width, height },
        },
      },
    },
  ];
  let elapsed = 0;
  for (const pause of pauses) {
    const hostUs = 1_000_000 + pause.atSourceUs + elapsed;
    rows.push(
      { event: "pauseBegan", data: { hostUs } },
      { event: "pauseEnded", data: { hostUs: hostUs + pause.elapsedPauseUs, pause } },
    );
    elapsed += pause.elapsedPauseUs;
  }
  for (let start = 0; start < samples.length; start += 30)
    rows.push({ event: "cursorSamples", data: { samples: samples.slice(start, start + 30) } });
  rows.push({ event: "finished", data: {} });
  return rows;
}
