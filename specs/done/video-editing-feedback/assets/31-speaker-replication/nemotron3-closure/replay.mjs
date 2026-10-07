import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const root = new URL(".", import.meta.url);
const protocol = JSON.parse(await readFile(new URL("protocol.json", root), "utf8"));
const receiptBytes = await readFile(new URL(protocol.relocationSmoke.receipt, root));
const receipt = JSON.parse(receiptBytes);
const sha256 = createHash("sha256").update(receiptBytes).digest("hex");

assert.equal(protocol.status, "acquisition-reproducibility-refused");
assert.equal(protocol.relocationSmoke.state, "passed-with-donor-clone");
assert.equal(protocol.relocationSmoke.networkDenied, true);
assert.equal(sha256, protocol.relocationSmoke.receiptSha256);
assert.equal(receipt.ok, true);
assert.equal(receipt.restored, true);
assert.equal(receipt.lhotseOriginInsideClosure, true);
assert.equal(receipt.modelOriginInsideClosure, true);
assert.equal(protocol.independentMaterialization.state, "not-run");
assert.equal(protocol.quality.shortGate, "not-rerun");
assert.equal(protocol.quality.longForm, "blocked");
assert.equal(protocol.quality.promotion, false);
assert(protocol.independentMaterialization.observedFreeBytes < protocol.independentMaterialization.runtimeLowerBoundBytes);
assert(protocol.relocationSmoke.donorRootsDenied.length >= 2);

console.log(JSON.stringify({
  ok: true,
  status: protocol.status,
  relocation: protocol.relocationSmoke.state,
  cleanMaterialization: protocol.independentMaterialization.state,
  quality: protocol.quality,
}));
