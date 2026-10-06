import assert from "node:assert/strict";
import { compare, fromTime, rational } from "@yap/composition";

/** Validate unchanged constant-rate fixture clocks without comparing rounded microsecond labels. */
export function verifyPictureSample(sample, fps) {
  const reference = sample.reference;
  assert.equal(reference.status, "available", "Player observation must be available");
  const value = BigInt(reference.actualValue),
    scale = BigInt(reference.actualTimescale);
  assert.ok(scale > 0n);
  assert.equal(value * BigInt(fps), BigInt(sample.index) * scale, "Player physical sample");
  const source = sample.source.receipt.published.output;
  const project = sample.project.receipt.published.output;
  assert.equal(source.requestedSourceUs, Math.ceil((sample.index * 1000000) / fps));
  assert.equal(project.frame.index, sample.index, "Project frame membership");
  assert.equal(project.pictures.length, 1, "Unchanged fixture has one source picture");
  const picture = project.pictures[0];
  assert.equal(picture.status, "available");
  assert.equal(
    compare(
      fromTime(picture.requestedSourceUs),
      rational(BigInt(sample.index) * 1000000n, BigInt(fps)),
    ),
    0,
    "Exact project source request",
  );
  for (const observation of [source, picture]) {
    const physical = observation.sample;
    assert.ok(physical && physical.timescale > 0, "Missing physical sample");
    assert.equal(physical.originUs, 0, "Fixture source clock origin");
    assert.equal(
      BigInt(physical.value) * scale,
      value * BigInt(physical.timescale),
      "Public physical sample must match player",
    );
  }
}

/** Enforce the frozen observation space independently of raster agreement. */
export function verifyPicturePixels(receipt) {
  assert.equal(receipt.outputProfile, "kCGColorSpaceSRGB", "Observer must produce sRGB");
  assert.equal(receipt.sourceProfile, "kCGColorSpaceSRGB", "Delivered PNG must carry sRGB");
  assert.equal(
    receipt.sourceProfileSHA256,
    "2b3aa1645779a9e634744faf9b01e9102b0c9b88fd6deced7934df86b949af7e",
    "Frozen sRGB ICC identity",
  );
  assert.equal(receipt.opaque, true, "Opaque picture observation");
}
