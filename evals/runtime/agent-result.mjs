export function agentResult(agent, stdout, exitCode) {
  const events = stdout
    .split("\n")
    .filter((line) => line.trim().startsWith("{"))
    .map((line) => JSON.parse(line));
  const failed = events.find((event) => event.type === "turn.failed");
  const diagnostic = failed ?? events.findLast((event) => event.type === "error");
  const result = events.findLast((event) => event.type === "result");
  if (exitCode !== 0 || failed || result?.is_error) {
    throw new Error(
      diagnostic?.error?.message ??
        diagnostic?.message ??
        result?.result ??
        `${agent} exited ${exitCode}`,
    );
  }
  if (agent === "claude") {
    if (!result || (!result.result && !result.structured_output))
      throw new Error("Claude returned no completed response");
    const content = events.flatMap((event) => event.message?.content ?? []);
    const tools = content
      .filter((item) => item.type === "tool_use")
      .map((item) => {
        const receipt = content.find(
          (entry) => entry.type === "tool_result" && entry.tool_use_id === item.id,
        );
        return {
          tool: item.name,
          input: item.input,
          output: receipt?.content,
          isError: receipt?.is_error ?? false,
          completed: !!receipt,
        };
      });
    const commands = tools
      .filter((item) => item.tool === "Bash")
      .map((item) => ({ command: item.input.command, output: item.output, isError: item.isError }));
    const reads = tools.filter((item) => ["Read", "Skill", "Glob", "Grep"].includes(item.tool));
    return {
      response: result.result,
      structured: result.structured_output,
      commands,
      ...(reads.length ? { reads } : {}),
    };
  }
  if (!events.some((event) => event.type === "turn.completed"))
    throw new Error(diagnostic?.message ?? "Codex returned no completed turn");
  const message = events.findLast(
    (event) => event.type === "item.completed" && event.item?.type === "agent_message",
  );
  if (!message?.item.text) throw new Error("Codex returned no completed response");
  const commands = events
    .filter((event) => event.type === "item.completed" && event.item?.type === "command_execution")
    .map(({ item }) => ({
      command: item.command,
      output: item.aggregated_output,
      exitCode: item.exit_code,
    }));
  return { response: message.item.text, commands };
}
