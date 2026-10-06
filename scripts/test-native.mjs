import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { withEvidenceDirectory } from "../helpers/mac/Tests/fixtures/evidence-directory.mjs";

const [product, ...args] = process.argv.slice(2);
const key = {
  YapFrameTests: "YAP_FRAME_EVIDENCE",
  YapSourceAudioTests: "YAP_SOURCE_AUDIO_EVIDENCE",
  YapSelectedAudioTests: "YAP_SELECTED_AUDIO_EVIDENCE",
}[product];
if (!key) throw Error("Select a native test product with an evidence directory");
const packagePath = fileURLToPath(new URL("../helpers/mac/", import.meta.url));
execFileSync(
  "swift",
  [
    "build",
    "--build-system",
    "native",
    "--jobs",
    "2",
    "--package-path",
    packagePath,
    "--product",
    product,
  ],
  {
    stdio: "inherit",
    timeout: 180000,
  },
);
withEvidenceDirectory(key, (env) =>
  execFileSync(join(packagePath, ".build/debug", product), args, {
    env,
    stdio: "inherit",
    timeout: 120000,
  }),
);
