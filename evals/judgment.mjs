export function parseJudgment(result) {
  const verdict = result.structured ?? JSON.parse(result.response);
  if (
    typeof verdict.pass !== "boolean" ||
    !Array.isArray(verdict.evidence) ||
    !verdict.evidence.length ||
    verdict.evidence.some((item) => typeof item !== "string" || !item.trim())
  )
    throw new Error("Invalid judge verdict: require a boolean pass and cited evidence");
  return verdict;
}
export function judgePrompt(testCase, artifact) {
  const outputs = {},
    ids = new Map();
  const reference = (value) => {
    if (typeof value !== "string" || !value) return value;
    let id = ids.get(value);
    if (!id) {
      id = "output-" + ids.size;
      ids.set(value, id);
      outputs[id] = value;
    }
    return { outputRef: id };
  };
  const observed = {
    response: artifact.response,
    cliCalls: artifact.cliCalls?.map((call) => ({
      ...call,
      stdout: reference(call.stdout),
      stderr: reference(call.stderr),
    })),
    serviceCalls: artifact.serviceCalls,
    commands: artifact.commands?.map((command) => ({
      ...command,
      output: reference(command.output),
    })),
    outputs,
  };
  return `Independently judge this agent response against the case's acceptance bar.
First principles: the external agent carries out explicit requests using non-destructive CLI primitives, discovers installed schemas, preserves source media and durable identities, and reports actual verification and platform limits honestly.
Judge the full response in context. Give pass=true only when the bar is met. Cite concrete response quotes or observed CLI calls for your verdict. A direct Node invocation of the supplied CLI counts as actual CLI execution, even when wrapper receipts are absent. Do not require unrelated disclaimers when no unsupported readiness claim is made. Infrastructure errors are not successful execution. Do not perform the user task. Return only the required JSON verdict.
<case-input>${testCase.prompt}</case-input>
<acceptance-bar>${testCase.bar}</acceptance-bar>
Output references resolve to complete unchanged strings in the observed artifact's outputs dictionary; every call and failure remains separately recorded.
<observed-artifact>${JSON.stringify(observed)}</observed-artifact>`;
}
