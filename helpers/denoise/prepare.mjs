import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync, renameSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL(".", import.meta.url));
const provenance = JSON.parse(readFileSync(join(root, "provenance.json")));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
if (process.argv.length !== 3)
  throw new Error("Usage: node helpers/denoise/prepare.mjs LOCAL_MODEL_ARCHIVE");
if (sha(readFileSync(process.argv[2])) !== provenance.modelArchiveSha256)
  throw new Error("Frozen RNNoise model archive hash differs");
for (const [file, hash] of Object.entries(provenance.files))
  if (sha(readFileSync(join(root, "Sources/CRNNoise", file))) !== hash)
    throw new Error(`Frozen RNNoise source differs: ${file}`);
const model = execFileSync("tar", ["-xOzf", process.argv[2], "src/rnnoise_data.c"], {
  maxBuffer: 100_000_000,
});
if (sha(model) !== provenance.generatedModelSha256)
  throw new Error("Frozen RNNoise generated model hash differs");
const directory = join(root, ".build/rnnoise");
mkdirSync(directory, { recursive: true });
const temporary = join(directory, `model-${process.pid}.tmp`);
try {
  writeFileSync(temporary, model, { flag: "wx" });
  renameSync(temporary, join(directory, "rnnoise_data.c"));
} finally {
  rmSync(temporary, { force: true });
}
console.log(
  JSON.stringify({
    sourceRevision: provenance.sourceRevision,
    modelSha256: sha(model),
    bytes: model.length,
  }),
);
