#!/usr/bin/env node
import { mkdir, readFile, writeFile, readdir, realpath } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve, join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { arch, release } from "node:os";
import { engines, normalize } from "../packages/test-harness/speech/engines.mjs";
import { evaluate } from "../packages/test-harness/speech/evaluate.mjs";

const json = async (path) => JSON.parse(await readFile(path, "utf8"));
const save = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + "\n");
function command(executable, args, cwd, capture = false) {
  const result = spawnSync(executable, args, {
    cwd,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
    timeout: 300_000,
    detached: true,
    maxBuffer: 8 * 1024 ** 2,
  });
  if (result.error && result.pid) {
    try {
      process.kill(-result.pid, "SIGKILL");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
  if (result.error || result.status !== 0)
    throw new Error(
      `${executable} failed (${result.status}): ${result.error?.message ?? result.stderr ?? ""}`,
    );
  return result.stdout?.trim();
}
async function sha(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
async function hashes(directory, prefix = "") {
  const output = {};
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (entry.name === ".cache") continue;
    const name = prefix + entry.name,
      path = join(directory, entry.name);
    if (entry.isDirectory()) Object.assign(output, await hashes(path, name + "/"));
    else output[name] = await sha(path);
  }
  return output;
}
function setupPlan(engine, cache) {
  const source = join(cache, "source"),
    models = join(cache, "models");
  const plan = [
    ["git", ["clone", "--depth", "1", "--branch", engine.version, engine.repository, source]],
    ["git", ["-C", source, "rev-parse", "HEAD"]],
    [
      "hf",
      [
        "download",
        engine.modelRepo,
        "--revision",
        engine.modelRevision,
        "--local-dir",
        models,
        ...engine.include.flatMap((pattern) => ["--include", pattern]),
      ],
    ],
  ];
  if (engine.tokenizer)
    plan.push([
      "hf",
      [
        "download",
        engine.tokenizer.repo,
        "--revision",
        engine.tokenizer.revision,
        "--local-dir",
        join(cache, "tokenizer"),
        ...[
          "config.json",
          "tokenizer.json",
          "tokenizer_config.json",
          "README.md",
          "LICENSE*",
        ].flatMap((pattern) => ["--include", pattern]),
      ],
    ]);
  plan.push([
    "swift",
    [
      "build",
      "-c",
      "release",
      "--package-path",
      source,
      "--product",
      engine.product,
      ...engine.buildArguments,
    ],
  ]);
  return plan;
}
async function externalCache(path) {
  const cache = resolve(path);
  await mkdir(cache, { recursive: true });
  const real = await realpath(cache);
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  if (real === repo || real.startsWith(repo + "/"))
    throw new Error("Speech caches must be outside the repository");
  return real;
}
async function main() {
  const [action, first, second, third, fourth] = process.argv.slice(2);
  if (action === "evaluate") {
    const dataset = await json(first),
      runs = await json(second);
    const report = evaluate(dataset, runs);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.status === "pass" ? 0 : report.status === "pending" ? 2 : 1;
    return;
  }
  if (!["plan", "prepare", "run"].includes(action) || !engines[first] || !second) {
    console.log(
      "Usage:\n  node scripts/speech-eval.mjs plan|prepare ENGINE CACHE\n  node scripts/speech-eval.mjs run ENGINE CACHE CLIP.json OUTPUT_DIRECTORY\n  node scripts/speech-eval.mjs evaluate DATASET.json RUNS.json\nEngines: parakeet, whisperkit. prepare downloads and builds; plan only prints commands.\nrun reads only the explicit audioPath in CLIP.json and denies inference network.\nEvaluation exit codes: 0 pass, 1 fail/error, 2 pending.",
    );
    if (action && action !== "--help") process.exitCode = 1;
    return;
  }
  const engine = engines[first];
  if (action === "plan") {
    console.log(JSON.stringify({ engine, commands: setupPlan(engine, resolve(second)) }, null, 2));
    return;
  }
  const cache = await externalCache(second),
    source = join(cache, "source");
  if (action === "prepare") {
    for (const [executable, args] of setupPlan(engine, cache)) {
      if (args[0] === "clone" && existsSync(source)) continue;
      const output = command(
        executable,
        args,
        undefined,
        executable === "git" && args.includes("rev-parse"),
      );
      if (args.includes("rev-parse") && output !== engine.revision)
        throw new Error("Runtime checkout does not match pinned revision");
    }
    await save(join(cache, "provenance.json"), {
      engine: first,
      ...engine,
      preparedAt: new Date().toISOString(),
      swift: command("swift", ["--version"], undefined, true),
      binarySha256: await sha(join(source, ".build", "release", engine.product)),
      packageResolvedSha256: existsSync(join(source, "Package.resolved"))
        ? await sha(join(source, "Package.resolved"))
        : null,
      modelFiles: await hashes(join(cache, "models")),
      tokenizerFiles: engine.tokenizer ? await hashes(join(cache, "tokenizer")) : null,
    });
    return;
  }
  if (!third || !fourth) throw new Error("run requires a clip manifest and output directory");
  const clip = await json(third);
  if (!clip.id || !clip.audioPath || !/^[a-f0-9]{64}$/.test(clip.audioSha256 ?? ""))
    throw new Error("Clip requires id, audioPath, audioSha256");
  const audio = resolve(dirname(resolve(third)), clip.audioPath);
  if ((await sha(audio)) !== clip.audioSha256)
    throw new Error("Audio does not match annotated fixture hash");
  const provenance = await json(join(cache, "provenance.json"));
  if (
    provenance.engine !== first ||
    provenance.revision !== engine.revision ||
    provenance.modelRevision !== engine.modelRevision ||
    command("git", ["-C", source, "rev-parse", "HEAD"], undefined, true) !== engine.revision
  )
    throw new Error("Prepared runtime/model identity mismatch");
  if (
    JSON.stringify(await hashes(join(cache, "models"))) !== JSON.stringify(provenance.modelFiles) ||
    (engine.tokenizer &&
      JSON.stringify(await hashes(join(cache, "tokenizer"))) !==
        JSON.stringify(provenance.tokenizerFiles))
  )
    throw new Error("Prepared model assets changed");
  const output = resolve(fourth);
  await mkdir(output, { recursive: true });
  const runDirectory = join(output, `run-${Date.now()}`);
  await mkdir(runDirectory);
  const model = join(cache, "models", engine.modelFolder);
  const rawPath = join(
    runDirectory,
    first === "parakeet" ? "raw.json" : basename(audio).replace(/\.[^.]*$/, "") + ".json",
  );
  const args =
    first === "parakeet"
      ? [
          "transcribe",
          audio,
          "--model-version",
          "v2",
          "--model-dir",
          model,
          "--word-timestamps",
          "--output-json",
          rawPath,
        ]
      : [
          "transcribe",
          "--model-path",
          model,
          "--download-tokenizer-path",
          join(cache, "tokenizer"),
          "--audio-path",
          audio,
          "--language",
          "en",
          "--word-timestamps",
          "--report",
          "--report-path",
          runDirectory,
        ];
  const binary = join(source, ".build", "release", engine.product);
  if ((await sha(binary)) !== provenance.binarySha256)
    throw new Error("Prepared executable changed; prepare again");
  const timePath = join(runDirectory, "resources.txt");
  const started = performance.now();
  command(
    "/usr/bin/time",
    [
      "-l",
      "-o",
      timePath,
      "/usr/bin/sandbox-exec",
      "-p",
      "(version 1)(allow default)(deny network*)",
      binary,
      ...args,
    ],
    runDirectory,
  );
  const elapsedSeconds = (performance.now() - started) / 1000;
  const resources = await readFile(timePath, "utf8");
  const peakRssBytes = Number(resources.match(/(\d+)\s+maximum resident set size/)?.[1]) || null;
  const result = {
    clipId: clip.id,
    engine: first,
    runtimeRevision: engine.revision,
    modelRevision: engine.modelRevision,
    audioSha256: clip.audioSha256,
    modelFiles: provenance.modelFiles,
    tokenizerFiles: provenance.tokenizerFiles,
    binarySha256: await sha(binary),
    hardware: { arch: arch(), release: release() },
    network: "sandbox-deny-network",
    command: [binary, ...args],
    elapsedSeconds,
    peakRssBytes,
    warm: false,
    ...normalize(first, await json(rawPath)),
  };
  await save(join(runDirectory, "result.json"), result);
  console.log(join(runDirectory, "result.json"));
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
