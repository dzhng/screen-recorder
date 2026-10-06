import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const planPath = join(
  root,
  "specs/done/ffmpeg-parity/evidence/speaker-original/runtime-acquisition-plan.json",
);
const inputs = JSON.parse(
  await readFile(new URL("alignment-inputs.json", import.meta.url), "utf8"),
);
const plan = JSON.parse(await readFile(planPath, "utf8"));
const inventory = JSON.parse(
  gunzipSync(
    await readFile(
      join(root, "specs/done/ffmpeg-parity/evidence/speaker-runtime/runtime-manifest.json.gz"),
    ),
  ),
);
const nativePolicy = JSON.parse(
  await readFile(
    join(root, "specs/done/ffmpeg-parity/evidence/speaker-runtime/native-policy.json"),
    "utf8",
  ),
);
const hash = (content) => createHash("sha256").update(content).digest("hex");
const packageNames = new Set(
  plan.install.map((entry) => basename(new URL(entry.download_info.url).pathname)),
);
const files = [
  inputs.files.find((file) => file.path === inputs.interpreterArchive),
  ...inputs.files.filter((file) => packageNames.has(file.path)),
];
if (files.some((file) => !file) || files.length !== packageNames.size + 1)
  throw new Error("Speaker acquisition inputs do not cover the measured package plan");
const installs = inputs.installs
  .map((group) => ({ ...group, paths: group.paths.filter((path) => packageNames.has(path)) }))
  .filter((group) => group.paths.length > 0);
if (new Set(installs.flatMap((group) => group.paths)).size !== packageNames.size)
  throw new Error("Speaker acquisition package groups do not cover the measured plan");
const resources = [];
for (const [path, source] of [
  ["prepare.py", "helpers/model-runtime/prepare.py"],
  ["assemble.py", "helpers/model-runtime/assemble.py"],
  ["native.py", "helpers/model-runtime/native.py"],
  ["launch.py", "helpers/model-runtime/launch.py"],
  ["worker.py", "helpers/speaker/worker.py"],
]) {
  const content = await readFile(join(root, source), "utf8");
  resources.push({ path, content, sha256: hash(content) });
}
const runtimePaths = new Set(inventory.map((entry) => entry.path));
if (
  nativePolicy.files.length !== 54 ||
  nativePolicy.files.some((file) => !runtimePaths.has(file.path))
)
  throw new Error("Speaker native relocation policy no longer matches its measured inventory");
const destination = join(root, "packages/core/src/model-data/speaker-acquisition.generated.json");
await writeFile(
  destination,
  JSON.stringify({
    ...inputs,
    files,
    installs,
    resources,
    nativePolicy,
  }) + "\n",
);
console.log(JSON.stringify({ destination, files: files.length, installs: installs.length }));
