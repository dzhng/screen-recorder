import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const inputs = JSON.parse(
  await readFile(new URL("alignment-inputs.json", import.meta.url), "utf8"),
);
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
const files = inputs.files;
const canonical = (value) => value.toLowerCase().replace(/[._]+/g, "-");
const project = (value) => {
  const stem = value.replace(/\.tar\.gz$|\.whl$|\.zip$/, "");
  const match = stem.match(/^(.+?)-\d/);
  if (!match) throw new Error(`Cannot identify pinned package: ${value}`);
  return canonical(match[1]);
};
const layers = new Map();
for (const entry of inventory) {
  const match = entry.path.match(/^python\/lib\/python3\.12\/model-layers\/(\d+)\/([^/]+)-[^/]+\.dist-info\/METADATA$/);
  if (match) layers.set(canonical(match[2]), `supplemental/${match[1]}`);
}
const installs = [];
for (const group of inputs.installs) {
  const byTarget = new Map();
  for (const path of group.paths) {
    // Source builds need their build backend in ordinary startup; keep the
    // pinned build tools and their source outputs in primary. Supplemental
    // trees are only for the pre-measured binary dependency layers.
    const target = group.sourceBuild || ["setuptools", "wheel"].includes(project(path))
      ? undefined
      : layers.get(project(path));
    const key = target ?? "primary";
    if (!byTarget.has(key)) byTarget.set(key, []);
    byTarget.get(key).push(path);
  }
  for (const [target, paths] of byTarget) {
    installs.push({ ...group, paths, ...(target === "primary" ? {} : { target }) });
  }
}
const supplemental = [...new Set(layers.values())].sort();
if (new Set(installs.flatMap((group) => group.paths)).size !== files.length - 1)
  throw new Error("Speaker acquisition package groups do not cover every pinned input");
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
    supplemental,
    resources,
    nativePolicy,
  }) + "\n",
);
console.log(JSON.stringify({ destination, files: files.length, installs: installs.length }));
