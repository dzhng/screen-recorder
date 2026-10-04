import assert from "node:assert/strict";
import { test } from "node:test";
import { parseJudgment } from "./judgment.mjs";

test("a judge cannot pass a run with an unsupported verdict or no cited evidence", () => {
  assert.throws(
    () => parseJudgment({ response: '{"pass":"yes","evidence":["Looks fine"]}' }),
    /Invalid judge verdict/,
  );
  assert.throws(
    () => parseJudgment({ structured: { pass: true, evidence: [] } }),
    /Invalid judge verdict/,
  );
});
