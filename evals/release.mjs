import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runContainer } from "./container.mjs";

export function verifyRelease({ archive, receipt, checksums, archiveName, tag }) {
  for (const [name, bytes] of [
    [archiveName, archive],
    ["release.json", receipt],
  ]) {
    const line = checksums.split("\n").find((line) => line.endsWith(`  ${name}`));
    const expected = line?.split("  ")[0];
    if (!expected || createHash("sha256").update(bytes).digest("hex") !== expected)
      throw new Error(`Checksum mismatch: ${name}`);
  }
  const metadata = JSON.parse(receipt);
  if (metadata.tag !== tag || metadata.architecture !== "arm64" || metadata.platform !== "macOS")
    throw new Error("Release receipt does not match the selected macOS arm64 release");
  return metadata;
}
async function download(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "screenrec-evals" },
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Release download failed: HTTP ${response.status} ${url}`);
  return Buffer.from(await response.arrayBuffer());
}
export async function releaseCli({ tag = "latest", cache, image }) {
  const endpoint = tag === "latest" ? "latest" : `tags/${encodeURIComponent(tag)}`;
  const release = JSON.parse(
    await download(`https://api.github.com/repos/dzhng/screen-recorder/releases/${endpoint}`),
  );
  const archiveName = `ScreenRecorder-${release.tag_name}-macos-arm64.zip`;
  const directory = join(cache, release.tag_name);
  await mkdir(directory, { recursive: true });
  try {
    const bundle = await readFile(join(directory, "main.mjs"));
    const receipt = JSON.parse(await readFile(join(directory, "release.json"), "utf8"));
    const expected = (await readFile(join(directory, "main.sha256"), "utf8")).trim();
    if (createHash("sha256").update(bundle).digest("hex") !== expected)
      throw new Error("Cached CLI checksum mismatch; remove this release cache and rerun");
    return { bundle, receipt };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const bytes = {};
  for (const name of [archiveName, "release.json", "SHA256SUMS"]) {
    const asset = release.assets.find((asset) => asset.name === name);
    if (!asset) throw new Error(`Release asset missing: ${name}`);
    bytes[name] = await download(asset.browser_download_url);
  }
  const receipt = verifyRelease({
    archive: bytes[archiveName],
    receipt: bytes["release.json"],
    checksums: bytes.SHA256SUMS.toString("utf8"),
    archiveName,
    tag: release.tag_name,
  });
  const extraction = await runContainer({
    image,
    network: false,
    request: { mode: "extract-cli" },
    files: { "release.zip": bytes[archiveName] },
  });
  if (extraction.error) throw new Error(extraction.error);
  const bundle = Buffer.from(extraction.bundleBase64, "base64");
  await writeFile(join(directory, "main.mjs"), bundle);
  await writeFile(
    join(directory, "main.sha256"),
    createHash("sha256").update(bundle).digest("hex") + "\n",
  );
  await writeFile(join(directory, "release.json"), JSON.stringify(receipt, null, 2) + "\n");
  return { bundle, receipt };
}
