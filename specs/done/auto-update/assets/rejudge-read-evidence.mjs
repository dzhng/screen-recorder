// Replays separate judgments from immutable saved runner transcripts.
// node specs/done/auto-update/assets/rejudge-read-evidence.mjs <final-result-directory>
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const { agentResult } = await import(pathToFileURL(join(root, "evals/runtime/agent-result.mjs")));
const { judgePrompt, parseJudgment } = await import(
  pathToFileURL(join(root, "evals/judgment.mjs"))
);
const { runContainer } = await import(pathToFileURL(join(root, "evals/container.mjs")));
const { credentials } = await import(pathToFileURL(join(root, "evals/auth.mjs")));
const directory = resolve(process.argv[2]);
const summary = JSON.parse(await readFile(join(directory, "summary.json"), "utf8"));
const caseBytes = await readFile(join(root, "evals/cases.json"));
if (createHash("sha256").update(caseBytes).digest("hex") !== summary.inputs["cases.json"])
  throw new Error("Case data changed; preserve original bars before replay");
const cases = JSON.parse(caseBytes);
const output = join(directory, "read-observer-replay");
await mkdir(output, { recursive: true });
const observerHashes = Object.fromEntries(
  await Promise.all(
    ["evals/runtime/agent-result.mjs", "evals/judgment.mjs"].map(async (path) => [
      path,
      createHash("sha256")
        .update(await readFile(join(root, path)))
        .digest("hex"),
    ]),
  ),
);
const auth = await credentials("codex");
const results = [];
for (const filename of (await readdir(directory))
  .filter((name) => name.endsWith(".runner.json"))
  .sort()) {
  const original = join(directory, filename),
    destination = join(output, filename.replace(".runner.json", ".judge.json"));
  try {
    const judged = JSON.parse(await readFile(destination, "utf8"));
    results.push({ name: filename, ...parseJudgment(judged) });
    continue;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const artifact = JSON.parse(await readFile(original, "utf8"));
  if (artifact.error) continue;
  const parsed = { ...artifact, ...agentResult(artifact.agent, artifact.stdout, artifact.exit) };
  const caseId = filename.replace(/-(codex|claude)-\d+\.runner\.json$/, "");
  const testCase = cases.find((item) => item.id === caseId);
  console.log(
    "Rejudging saved transcript:",
    filename,
    "completed read receipts:",
    parsed.reads?.length ?? 0,
  );
  const judged = await runContainer({
    image: summary.image,
    timeoutMs: 300000,
    auth,
    files: { "judge-schema.json": await readFile(join(root, "evals/judge-schema.json")) },
    request: { agent: "codex", judge: true, prompt: judgePrompt(testCase, parsed) },
  });
  await writeFile(destination, JSON.stringify(judged, null, 2) + "\n");
  if (judged.error) throw new Error(judged.error);
  const verdict = parseJudgment(judged);
  results.push({ name: filename, ...verdict });
  await writeFile(
    join(output, "summary.json"),
    JSON.stringify(
      {
        runnerSourceRevision: summary.sourceRevision,
        runnerImage: summary.image,
        observerHashes,
        originalRunnerHashes: Object.fromEntries(
          await Promise.all(
            (await readdir(directory))
              .filter((name) => name.endsWith(".runner.json"))
              .map(async (name) => [
                name,
                createHash("sha256")
                  .update(await readFile(join(directory, name)))
                  .digest("hex"),
              ]),
          ),
        ),
        results,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(filename, verdict.pass ? "PASS" : "FAIL", verdict.evidence.join(" "));
}
