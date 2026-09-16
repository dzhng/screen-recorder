import { raster } from "../../../../apps/macos/tests/fixtures/generated-capture.mjs";

// The SDK probe and production-worker oracle use the same readable, asymmetric IDs.
export function renderFrames() {
  return Array.from({ length: 6 }, (_, index) => {
    const { rgb, rect, text } = raster(320, 180);
    rect(0, 0, 320, 180, [30 + index * 30, 40, 100]);
    rect(0, 0, 30, 50, [255, 0, 0]);
    rect(270, 130, 50, 50, [0, 255, 80]);
    text("FRAME " + index, 40, 70, 4, [255, 255, 255]);
    return rgb;
  });
}
