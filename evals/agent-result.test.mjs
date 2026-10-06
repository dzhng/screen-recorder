import assert from "node:assert/strict";
import { test } from "node:test";
import { agentResult } from "./runtime/agent-result.mjs";

test("an interrupted Codex turn cannot pass using an earlier commentary message", () => {
  const transcript = [
    {
      type: "item.completed",
      item: { type: "agent_message", text: "I will check the installation." },
    },
    { type: "turn.failed", error: { message: "Authentication failed" } },
  ]
    .map(JSON.stringify)
    .join("\n");
  assert.throws(() => agentResult("codex", transcript, 1), /Authentication failed/);
});

test("a structured Claude judgment is valid without duplicate prose", () => {
  const verdict = { pass: false, evidence: ["Only help ran; no health result was observed."] };
  const stdout = JSON.stringify({
    type: "result",
    is_error: false,
    result: "",
    structured_output: verdict,
  });
  assert.deepEqual(agentResult("claude", stdout, 0), {
    response: "",
    structured: verdict,
    commands: [],
  });
});

test("a completed response is recovered across streamed diagnostics and commentary", () => {
  const stdout = [
    "diagnostic text",
    JSON.stringify({
      type: "item.completed",
      item: { type: "agent_message", text: "Inspecting the skill." },
    }),
    JSON.stringify({
      type: "item.completed",
      item: { type: "agent_message", text: "The native app requires macOS." },
    }),
    JSON.stringify({ type: "turn.completed" }),
  ].join("\n");
  assert.deepEqual(agentResult("codex", stdout, 0), {
    response: "The native app requires macOS.",
    commands: [],
  });
});

test("direct CLI executions remain available as grading evidence", () => {
  const command = "node /sandbox/cli/main.mjs job.get --socket /sandbox/service.sock";
  const stdout = [
    { type: "item.started", item: { type: "command_execution", command } },
    {
      type: "item.completed",
      item: {
        type: "command_execution",
        command,
        aggregated_output: '{"ok":true,"data":{"state":"failed"}}',
        exit_code: 0,
      },
    },
    { type: "item.completed", item: { type: "agent_message", text: "The job failed." } },
    { type: "turn.completed" },
  ]
    .map(JSON.stringify)
    .join("\n");
  assert.deepEqual(agentResult("codex", stdout, 0).commands, [
    { command, output: '{"ok":true,"data":{"state":"failed"}}', exitCode: 0 },
  ]);
});

test("Claude direct commands and their results reach the separate judge", () => {
  const command = "node /sandbox/cli/main.mjs service.health --socket /sandbox/missing.sock";
  const output = '{"ok":false,"error":{"code":"CONNECTION_ERROR"}}';
  const stdout = [
    {
      type: "assistant",
      message: { content: [{ type: "tool_use", id: "bash-1", name: "Bash", input: { command } }] },
    },
    {
      type: "user",
      message: {
        content: [{ type: "tool_result", tool_use_id: "bash-1", content: output, is_error: true }],
      },
    },
    { type: "result", is_error: false, result: "The service is unavailable." },
  ]
    .map(JSON.stringify)
    .join("\n");
  assert.deepEqual(agentResult("claude", stdout, 0).commands, [{ command, output, isError: true }]);
});

test("a recovered Codex connection retains its completed response and commands", () => {
  const stdout = [
    { type: "error", message: "Reconnecting... 1/5 (stream disconnected before completion)" },
    {
      type: "item.completed",
      item: {
        type: "command_execution",
        command: "yap capture.status --help",
        aggregated_output: '{"operations":[{"name":"capture.status"}]}',
        exit_code: 0,
      },
    },
    { type: "item.completed", item: { type: "agent_message", text: "Schema discovery passed." } },
    { type: "turn.completed" },
  ]
    .map(JSON.stringify)
    .join("\n");
  const result = agentResult("codex", stdout, 0);
  assert.equal(result.response, "Schema discovery passed.");
  assert.equal(result.commands[0].output, '{"operations":[{"name":"capture.status"}]}');
});

test("Claude successful, failed and incomplete reads remain distinct judge evidence", () => {
  const stdout = [
    {
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            id: "read-1",
            name: "Read",
            input: { file_path: "/skill/references/installation.md" },
          },
          { type: "tool_use", id: "read-2", name: "Read", input: { file_path: "/missing.md" } },
          { type: "tool_use", id: "skill-1", name: "Skill", input: { skill: "yap" } },
          {
            type: "tool_use",
            id: "incomplete",
            name: "Read",
            input: { file_path: "/unfinished.md" },
          },
        ],
      },
    },
    {
      type: "user",
      message: {
        content: [
          {
            type: "tool_result",
            tool_use_id: "read-1",
            content: "Complete installation instructions",
          },
          {
            type: "tool_result",
            tool_use_id: "read-2",
            content: "File does not exist",
            is_error: true,
          },
          { type: "tool_result", tool_use_id: "skill-1", content: "Loaded consumer skill" },
        ],
      },
    },
    { type: "result", is_error: false, result: "Procedure inspected." },
  ]
    .map(JSON.stringify)
    .join("\n");
  assert.deepEqual(agentResult("claude", stdout, 0).reads, [
    {
      tool: "Read",
      input: { file_path: "/skill/references/installation.md" },
      output: "Complete installation instructions",
      isError: false,
      completed: true,
    },
    {
      tool: "Read",
      input: { file_path: "/missing.md" },
      output: "File does not exist",
      isError: true,
      completed: true,
    },
    {
      tool: "Skill",
      input: { skill: "yap" },
      output: "Loaded consumer skill",
      isError: false,
      completed: true,
    },
    {
      tool: "Read",
      input: { file_path: "/unfinished.md" },
      output: undefined,
      isError: false,
      completed: false,
    },
  ]);
});
