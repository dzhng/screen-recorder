import { raster } from "../../../apps/macos/tests/fixtures/generated-capture.mjs";

export const width = 640,
  height = 360,
  fps = 30;
export const sourceEvents = [500000, 1500000, 2500000, 3500000];

export function sourceFrame(frame, alternate = false) {
  const { rgb, rect, text } = raster(width, height);
  const bright = sourceEvents.filter((at) => at <= (frame / fps) * 1000000).length % 2;
  rect(
    0,
    0,
    width,
    height,
    alternate ? (bright ? [150, 70, 105] : [72, 24, 55]) : bright ? [90, 110, 140] : [20, 40, 66],
  );
  rect(24, 20, 490, 195, alternate ? [72, 24, 55] : [20, 40, 66]);
  rect(0, 0, 18, 100, [240, 45, 45]);
  rect(width - 110, height - 18, 110, 18, [35, 230, 95]);
  text(
    `SOURCE ${alternate ? "B" : "A"} F${String(frame).padStart(3, "0")}`,
    32,
    35,
    5,
    [245, 245, 245],
  );
  text("FRAME COUNTER / 30 FPS", 32, 94, 3, [155, 195, 225]);
  const event = sourceEvents.indexOf((frame / fps) * 1000000);
  text(event < 0 ? "NO EVENT" : `EVENT ${event + 1}`, 32, 150, 4, [245, 235, 120]);
  rect(530, 130, 80, 65, event < 0 ? [30, 55, 80] : [245, 235, 35]);
  for (let bit = 0; bit < 8; bit++)
    rect(32 + bit * 48, 310, 28, 28, frame & (1 << bit) ? [240, 240, 240] : [10, 10, 10]);
  rect(550, 310, 50, 28, alternate ? [30, 50, 235] : [235, 40, 30]);
  return rgb;
}
