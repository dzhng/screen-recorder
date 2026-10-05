import assert from "node:assert/strict";
import { test } from "node:test";
import { judgePrompt, parseJudgment } from "./judgment.mjs";

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

test("repeated large CLI outputs reach the judge once without dropping calls or failures", () => {
  const catalog = "complete-discovered-schema".repeat(15000);
  const failure = '{"ok":false,"error":{"code":"CONNECTION_ERROR"}}';
  const artifact = {
    response: "Help works; service is unavailable.",
    reads: [{ path: "SKILL.md", status: "complete", text: "actual skill bytes" }],
    beforeProjectFiles: [{ path: "local-note", sha256: "before" }],
    projectFiles: [{ path: "local-note", sha256: "after" }],
    cliCalls: [
      { args: ["--help"], exit: 0, stdout: catalog, stderr: "" },
      { args: ["--help"], exit: 0, stdout: catalog, stderr: "" },
      { args: ["service.tools"], exit: 1, stdout: failure, stderr: "" },
    ],
    serviceCalls: [],
    commands: [{ command: "screenrec --help", output: catalog, exitCode: 0 }],
  };
  const prompt = judgePrompt({ prompt: "Check tools", bar: "Report the failure" }, artifact);
  assert.ok(prompt.length < 1_000_000, "Repeated schema bytes must not exceed judge input limit");
  const observed = JSON.parse(prompt.match(/<observed-artifact>(.*)<\/observed-artifact>/s)[1]);
  const read = (value) => (typeof value === "string" ? value : observed.outputs[value.outputRef]);
  assert.deepEqual(
    observed.cliCalls.map((c) => [c.args, c.exit, read(c.stdout)]),
    artifact.cliCalls.map((c) => [c.args, c.exit, c.stdout]),
  );
  assert.equal(read(observed.commands[0].output), catalog);
  assert.equal(observed.response, artifact.response);
  assert.deepEqual(observed.reads, artifact.reads);
  assert.deepEqual(observed.beforeProjectFiles, artifact.beforeProjectFiles);
  assert.deepEqual(observed.projectFiles, artifact.projectFiles);
  assert.equal(Object.values(observed.outputs).filter((value) => value === catalog).length, 1);
});
