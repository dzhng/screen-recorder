import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, copyFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};
if (option("--case") !== "reference-origins") throw new Error("Use --case reference-origins");
const output = resolve(option("--out", "/tmp/screenrec-voice-results"));
const python = option("--python", "/tmp/screenrec-voice-venv/bin/python");
const model = resolve(option("--model", "/tmp/screenrec-voice-model"));
if (!existsSync(python) || !existsSync(resolve(model, "model.safetensors"))) {
  throw new Error("Explicit runtime/model preparation is required; see slice18 evidence README");
}
const configPath = resolve(root, "packages/test-harness/editing/voice/cases.json");
const config = JSON.parse(readFileSync(configPath));
mkdirSync(output, { recursive: true });
function run(command, argv, options = {}) {
  const result = spawnSync(command, argv, { stdio: "inherit", timeout: 600_000, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited ${result.status}`);
}
for (const [name, range] of [
  ["reference", config.reference.sourceRange],
  ["context", config.contextRange],
]) {
  run("ffmpeg", [
    "-v",
    "error",
    "-nostdin",
    "-y",
    "-i",
    resolve(root, config.source),
    "-af",
    `atrim=start=${(range.startUs - config.sourceOriginUs) / 1e6}:end=${(range.endUs - config.sourceOriginUs) / 1e6},asetpts=PTS-STARTPTS`,
    "-ar",
    "24000",
    "-ac",
    "1",
    "-c:a",
    "pcm_f32le",
    resolve(output, `${name}.wav`),
  ]);
}
// These copies test identical reference bytes at different paths, not managed project retention.
for (const origin of config.origins)
  copyFileSync(resolve(output, "reference.wav"), resolve(output, `${origin}.wav`));
run(
  "/usr/bin/sandbox-exec",
  [
    "-p",
    "(version 1)(allow default)(deny network*)",
    python,
    resolve(root, "packages/test-harness/editing/voice/generate.py"),
    configPath,
    model,
    output,
    root,
  ],
  {
    env: {
      ...process.env,
      HF_HOME: "/tmp/screenrec-voice-hf",
      HF_HUB_OFFLINE: "1",
      TRANSFORMERS_OFFLINE: "1",
      HF_HUB_DISABLE_IMPLICIT_TOKEN: "1",
      TOKENIZERS_PARALLELISM: "false",
    },
  },
);
