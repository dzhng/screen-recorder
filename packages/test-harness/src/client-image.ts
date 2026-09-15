import { strict as assert } from "node:assert";
import { execFile } from "node:child_process";
import { randomInt } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { z } from "zod";

const run = promisify(execFile);
const scratch = await mkdtemp(join(tmpdir(), "screenrec-image-"));
const evidence = resolve(process.argv[2] ?? "specs/recording-for-ai/assets/client-image");
await mkdir(evidence, { recursive: true });
const serverFile = fileURLToPath(new URL("./image-probe.js", import.meta.url));
const renderer = fileURLToPath(new URL("../fixtures/TokenImage.swift", import.meta.url));
const expected = {
  first: String(randomInt(100000, 1000000)),
  second: String(randomInt(100000, 1000000)),
};
for (const id of ["first", "second"] as const) {
  await run("/usr/bin/swift", [renderer, join(scratch, `${id}.png`), expected[id]], {
    timeout: 60_000,
  });
}
const config = join(scratch, "mcp.json");
await writeFile(
  config,
  JSON.stringify({
    mcpServers: {
      screenrec_probe: {
        command: process.execPath,
        args: [serverFile],
        env: { SCREENREC_PROBE_DIR: scratch },
      },
    },
  }),
);
const version = (await run("claude", ["--version"], { timeout: 10_000 })).stdout.trim();
const answers = z.object({ first: z.string(), second: z.string() }).strict();
const output = z.object({ result: z.string(), is_error: z.boolean().optional() });
async function inspect(mode: "mcp" | "cli") {
  let prompt: string;
  const flags = [
    "-p",
    "--model",
    "opus",
    "--effort",
    "high",
    "--max-budget-usd",
    "2",
    "--output-format",
    "stream-json",
    "--verbose",
    "--no-session-persistence",
    "--strict-mcp-config",
    "--permission-mode",
    "dontAsk",
    "--disable-slash-commands",
    "--setting-sources",
    "",
  ];
  if (mode === "mcp") {
    flags.push(
      "--mcp-config",
      config,
      "--tools",
      "",
      "--allowedTools",
      "mcp__screenrec_probe__frame",
    );
    prompt =
      "Call the screenrec_probe frame tool with id first, read the visible six digits, then call it with id second and read those digits. Do not infer unseen content.";
  } else {
    const paths: string[] = [];
    for (const id of ["first", "second"]) {
      const response = await run(process.execPath, [serverFile, "--file", id], {
        env: { ...process.env, SCREENREC_PROBE_DIR: scratch },
        timeout: 5_000,
      });
      paths.push(z.object({ path: z.string() }).parse(JSON.parse(response.stdout)).path);
    }
    flags.push("--tools", "Read", "--allowedTools", "Read");
    prompt = `Use the Read image tool to view these two PNG files produced by a CLI, in order: ${paths.join(", ")}. Read the visible six digits in each. Do not infer unseen content.`;
  }
  prompt +=
    ' Your final response must be only JSON: {"first":"digits from first image","second":"digits from second image"}.';
  const running = run("claude", [...flags, "--", prompt], {
    cwd: scratch,
    timeout: 180_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  running.child.stdin?.end();
  const result = await running;
  await writeFile(join(evidence, `${mode}-exchange.jsonl`), result.stdout);
  const events: unknown[] = result.stdout
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const resultSchema = output.extend({ type: z.literal("result") });
  const final = events
    .map((event) => resultSchema.safeParse(event))
    .find((result) => result.success);
  assert(final?.success, `${mode} must return a final result event`);
  const response = final.data;
  await writeFile(
    join(evidence, `${mode}-response.json`),
    JSON.stringify(response, null, 2) + "\n",
  );
  if (mode === "cli") {
    const messageSchema = z.object({
      type: z.literal("assistant"),
      message: z.object({ content: z.array(z.unknown()) }),
    });
    const readSchema = z.object({
      type: z.literal("tool_use"),
      name: z.literal("Read"),
      input: z.object({ file_path: z.string() }),
    });
    const readPaths = events.flatMap((event) => {
      const message = messageSchema.safeParse(event);
      if (!message.success) return [];
      return message.data.message.content.flatMap((item) => {
        const read = readSchema.safeParse(item);
        return read.success ? [read.data.input.file_path] : [];
      });
    });
    for (const id of ["first", "second"])
      assert(
        readPaths.includes(join(scratch, `${id}.png`)),
        "The client must actually invoke its image-reading tool for both CLI files",
      );
  }
  assert.notEqual(response.is_error, true, `${mode} agent returned an error`);
  const actual = answers.parse(JSON.parse(response.result));
  assert.deepEqual(actual, expected, `${mode} must read both unseen image tokens`);
  return { mode, actual };
}
try {
  const mcp = await inspect("mcp");
  const calls = (await readFile(join(scratch, "calls.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { id: string });
  assert.deepEqual(
    new Set(calls.map((call) => call.id)),
    new Set(["first", "second"]),
    "Both real MCP image calls must occur",
  );
  const cli = await inspect("cli");
  for (const id of ["first", "second"])
    await copyFile(join(scratch, `${id}.png`), join(evidence, `${id}.png`));
  await copyFile(join(scratch, "calls.jsonl"), join(evidence, "mcp-calls.jsonl"));
  await writeFile(
    join(evidence, "verification.json"),
    JSON.stringify({ ok: true, client: version, expected, results: [mcp, cli] }, null, 2) + "\n",
  );
  await rm(join(evidence, "failure.json"), { force: true });
  process.stdout.write(JSON.stringify({ ok: true, client: version, evidence }) + "\n");
} catch (error) {
  await writeFile(
    join(evidence, "failure.json"),
    JSON.stringify(
      {
        ok: false,
        client: version,
        reason: error instanceof Error ? error.message : String(error),
        scratch,
      },
      null,
      2,
    ) + "\n",
  );
  throw error;
}
