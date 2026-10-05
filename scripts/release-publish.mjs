import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const [directory, tag, revision, ...extra] = process.argv.slice(2);
try {
  if (!directory || extra.length || !/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag ?? ""))
    throw new Error("Usage: node scripts/release-publish.mjs DIRECTORY TAG REVISION");
  const root = resolve(directory);
  const receipt = JSON.parse(readFileSync(join(root, "release.json")));
  if (receipt.tag !== tag || receipt.revision !== revision)
    throw new Error("Publication source/tag differs from verified receipt");
  const digest = (name) =>
    createHash("sha256")
      .update(readFileSync(join(root, name)))
      .digest("hex");
  for (const entry of readFileSync(join(root, "SHA256SUMS"), "utf8").trim().split("\n")) {
    const match = /^([0-9a-f]{64})  ([^/]+)$/.exec(entry);
    if (!match || digest(match[2]) !== match[1])
      throw new Error("Install-kit checksum verification failed");
  }
  for (const artifact of [receipt.updateArchive, receipt.appcast]) {
    if (!artifact || artifact.name.includes("/") || digest(artifact.name) !== artifact.sha256)
      throw new Error("Authenticated update artifact differs from package receipt");
  }
  const gh = (args) => {
    const result = spawnSync("gh", ["release", ...args], { cwd: root, encoding: "utf8" });
    if (result.error) throw result.error;
    return result;
  };
  const existing = gh(["view", tag, "--json", "isDraft"]);
  if (existing.status === 0 && JSON.parse(existing.stdout).isDraft === false) {
    console.log("Release is already published; its assets remain unchanged.");
  } else {
    const prerelease = tag.includes("-");
    if (existing.status !== 0) {
      const created = gh([
        "create",
        tag,
        "--verify-tag",
        "--draft",
        "--title",
        `Screen Recorder ${tag}`,
        "--notes-file",
        "NOTES.md",
        ...(prerelease ? ["--prerelease"] : []),
      ]);
      if (created.status !== 0) throw new Error(created.stderr || "Draft release creation failed");
    }
    const assets = [`ScreenRecorder-${tag}-macos-arm64.zip`, receipt.updateArchive.name];
    for (const name of ["appcast.xml", "SHA256SUMS", "release.json"]) assets.push(name);
    const upload = gh(["upload", tag, ...assets, "--clobber"]);
    if (upload.status !== 0) throw new Error(upload.stderr || "Draft upload failed");
    const published = gh([
      "edit",
      tag,
      "--draft=false",
      `--prerelease=${prerelease}`,
      `--latest=${!prerelease}`,
    ]);
    if (published.status !== 0) throw new Error(published.stderr || "Release publication failed");
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
