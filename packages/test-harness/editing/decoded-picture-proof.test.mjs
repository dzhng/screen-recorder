import assert from "node:assert/strict";
import test from "node:test";
import { verifyPictureSample } from "./decoded-picture-proof.mjs";
const fixture = () => ({
  index: 1,
  reference: { status: "available", actualValue: "1", actualTimescale: 24 },
  source: {
    receipt: {
      published: {
        output: { requestedSourceUs: 41667, sample: { value: "1", timescale: 24, originUs: 0 } },
      },
    },
  },
  project: {
    receipt: {
      published: {
        output: {
          frame: { index: 1 },
          pictures: [
            {
              status: "available",
              requestedSourceUs: { numerator: 125000, denominator: 3 },
              sample: { value: "1", timescale: 24, originUs: 0 },
            },
          ],
        },
      },
    },
  },
});
test("unchanged source/project pictures require the same exact physical sample as the player", () => {
  const sample = fixture();
  verifyPictureSample(sample, 24);
  sample.project.receipt.published.output.pictures[0].sample.value = "2";
  assert.throws(() => verifyPictureSample(sample, 24), /physical sample/);
});

const pixelReceipt = () => ({
  outputProfile: "kCGColorSpaceSRGB",
  sourceProfile: "kCGColorSpaceSRGB",
  sourceProfileSHA256: "2b3aa1645779a9e634744faf9b01e9102b0c9b88fd6deced7934df86b949af7e",
  opaque: true,
});
test("a shared non-sRGB observation space cannot certify picture agreement", async () => {
  const { verifyPicturePixels } = await import("./decoded-picture-proof.mjs");
  const receipt = pixelReceipt();
  verifyPicturePixels(receipt);
  receipt.outputProfile = "kCGColorSpaceDisplayP3";
  assert.throws(() => verifyPicturePixels(receipt), /produce sRGB/);
});
test("a non-sRGB encoded PNG cannot inherit the observer's profile", async () => {
  const { verifyPicturePixels } = await import("./decoded-picture-proof.mjs");
  const receipt = pixelReceipt();
  receipt.sourceProfile = "kCGColorSpaceDisplayP3";
  assert.throws(() => verifyPicturePixels(receipt), /carry sRGB/);
});
test("a named sRGB profile with different ICC bytes cannot satisfy the frozen recipe", async () => {
  const { verifyPicturePixels } = await import("./decoded-picture-proof.mjs");
  const receipt = pixelReceipt();
  receipt.sourceProfileSHA256 = "unrelated";
  assert.throws(() => verifyPicturePixels(receipt), /ICC identity/);
});
