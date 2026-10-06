import assert from "node:assert/strict";
import { test } from "node:test";
import { collectUseCaseRouting } from "./autonomous-routing.mjs";

const references = new URL("../../../skills/yap/references/", import.meta.url).pathname;

test("fresh media acceptance records every focused workflow route", async () => {
  const receipt = await collectUseCaseRouting(references);
  assert.deepEqual(
    receipt.map(({ useCase }) => useCase),
    ["launch", "podcast", "teaser"],
  );
  for (const route of receipt) {
    assert.equal(route.policy.capabilityQuestionFirst, true);
    assert.equal(route.policy.humanQaRequired, false);
    assert.match(route.provenance.focusedReference.sha256, /^[a-f0-9]{64}$/);
  }
});
