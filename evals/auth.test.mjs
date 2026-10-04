import assert from "node:assert/strict";
import { test } from "node:test";
import { redact } from "./auth.mjs";

test("credentials echoed in transcripts are removed before evidence is saved", () => {
  const secret = "eval-only-token-do-not-publish";
  const value = {
    stdout: `printed ${secret}`,
    stderr: `${secret}\n${secret}`,
    response: "No service was ready.",
  };
  assert.deepEqual(redact(value, [secret]), {
    stdout: "printed [REDACTED]",
    stderr: "[REDACTED]\n[REDACTED]",
    response: "No service was ready.",
  });
});
