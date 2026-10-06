import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const [movie, destination, ...extra] = process.argv.slice(2);
if (!movie || !destination || extra.length)
  throw new Error("Usage: node continuous-playback.mjs movie.mp4 evidence-directory");
const source = join(dirname(fileURLToPath(import.meta.url)), "ContinuousPlayback.swift");
const out = resolve(destination);
const scratch = await mkdtemp(join(tmpdir(), "yap-continuous-playback-"));
await mkdir(out, { recursive: true });
try {
  const binary = join(scratch, "probe");
  execFileSync("swiftc", ["-parse-as-library", source, "-o", binary], { timeout: 60_000 });
  let failure;
  let stdout = "";
  try {
    stdout = execFileSync(binary, [resolve(movie), join(scratch, "report.json")], {
      timeout: 45_000,
      encoding: "utf8",
    });
  } catch (error) {
    failure = error;
    stdout = error.stdout?.toString() ?? "";
  }
  // Preserve an emitted red report as well as green evidence; process failures are never passes.
  let report;
  try {
    report = JSON.parse(await readFile(join(scratch, "report.json"), "utf8"));
  } catch (error) {
    throw failure ?? error;
  }
  report.probeSourceSHA256 = createHash("sha256")
    .update(await readFile(source))
    .digest("hex");
  report.platform = execFileSync("sw_vers", [], { encoding: "utf8", timeout: 5_000 }).trim();
  report.swift = execFileSync("swiftc", ["--version"], { encoding: "utf8", timeout: 5_000 }).trim();
  await writeFile(join(out, "report.json.gz"), gzipSync(JSON.stringify(report, null, 2) + "\n"));
  process.stdout.write(stdout);
  if (failure) throw failure;
} finally {
  await rm(scratch, { recursive: true, force: true });
}
