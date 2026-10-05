import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, open, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import type { FFmpegToolAvailability } from "@screenrec/protocol";
import { cliWorker, nativeResult } from "./worker.js";

export type FFmpegInstallation = { directory: string; receiptSha256: string };
const digest = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

async function readResource(path: string, limit: number, signal: AbortSignal, retain = false) {
  signal.throwIfAborted();
  // Nonblocking open plus fstat refuses a substituted FIFO without waiting for a writer.
  const file = await open(path, constants.O_RDONLY | constants.O_NONBLOCK);
  try {
    const metadata = await file.stat();
    if (!metadata.isFile() || metadata.size > limit)
      throw new Error("Bundled FFmpeg resource is not a bounded regular file");
    const hash = createHash("sha256"),
      chunks: Buffer[] = [];
    const buffer = Buffer.alloc(64 * 1024);
    let total = 0;
    for (;;) {
      signal.throwIfAborted();
      const { bytesRead } = await file.read(
        buffer,
        0,
        Math.min(buffer.length, limit - total + 1),
        null,
      );
      signal.throwIfAborted();
      if (!bytesRead) break;
      total += bytesRead;
      if (total > limit) throw new Error("Bundled FFmpeg resource exceeds its byte budget");
      hash.update(buffer.subarray(0, bytesRead));
      if (retain) chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
    }
    return { sha256: hash.digest("hex"), bytes: total, contents: Buffer.concat(chunks) };
  } finally {
    await file.close();
  }
}

/** Verify selected bundle bytes before executing; absence never changes native defaults. */
export async function inspectFFmpegTools(
  installation?: FFmpegInstallation,
  requestSignal?: AbortSignal,
  nativeExecutable: string | undefined = process.env.SCREENREC_NATIVE,
): Promise<FFmpegToolAvailability> {
  try {
    const deadline = AbortSignal.timeout(5000);
    const signal = requestSignal ? AbortSignal.any([requestSignal, deadline]) : deadline;
    if (!installation || !isAbsolute(installation.directory) || !digest(installation.receiptSha256))
      throw new Error("This app has no configured bundled FFmpeg distribution");
    const { directory, receiptSha256 } = installation;
    const canonical = await realpath(directory);
    const receiptPath = join(directory, "receipt.json");
    const receiptBytes = await readResource(receiptPath, 1024 * 1024, signal, true);
    if (receiptBytes.sha256 !== receiptSha256)
      throw new Error("Bundled FFmpeg receipt hash differs");
    const receipt = JSON.parse(receiptBytes.contents.toString("utf8")) as {
      format: unknown;
      version: unknown;
      recipeSha256: unknown;
      sourceSha256: unknown;
      files: Record<string, unknown>;
    };
    if (
      receipt.format !== 1 ||
      typeof receipt.version !== "string" ||
      !digest(receipt.recipeSha256) ||
      !digest(receipt.sourceSha256) ||
      !receipt.files ||
      !digest(receipt.files["bin/ffmpeg"]) ||
      !digest(receipt.files["bin/ffprobe"])
    )
      throw new Error("Bundled FFmpeg receipt is invalid");
    const resources = Object.entries(receipt.files);
    if (resources.length > 256) throw new Error("Bundled FFmpeg resource count exceeds its budget");
    let remainingBytes = 256 * 1024 * 1024;
    for (const [file, expected] of resources) {
      signal.throwIfAborted();
      if (isAbsolute(file) || file.split("/").includes("..") || !digest(expected))
        throw new Error("Bundled FFmpeg receipt contains an invalid resource");
      const path = join(directory, file);
      const resolved = relative(canonical, await realpath(path));
      if (resolved === ".." || resolved.startsWith(`..${sep}`) || isAbsolute(resolved))
        throw new Error("Bundled FFmpeg resource escapes its distribution");
      const resource = await readResource(path, remainingBytes, signal);
      remainingBytes -= resource.bytes;
      if (resource.sha256 !== expected)
        throw new Error(`Bundled FFmpeg resource hash differs: ${file}`);
    }
    const executables = {
      ffmpeg: {
        path: join(directory, "bin/ffmpeg"),
        sha256: receipt.files["bin/ffmpeg"] as string,
      },
      ffprobe: {
        path: join(directory, "bin/ffprobe"),
        sha256: receipt.files["bin/ffprobe"] as string,
      },
    };
    let configuration = "";
    for (const [name, executable] of Object.entries(executables)) {
      await access(executable.path, constants.X_OK);
      if (!nativeExecutable) throw new Error("This app has no native CLI lifetime owner");
      const output = nativeResult(
        await cliWorker(
          {
            executable: executable.path,
            ownerExecutable: nativeExecutable,
            args: ["-version"],
            environment: { PATH: "/usr/bin:/bin" },
          },
          { timeoutMs: 2000, signal, maxBytes: 64 * 1024 },
        ),
      ) as { stdout: Buffer };
      const stdout = new TextDecoder("utf-8", { fatal: true }).decode(output.stdout);
      if (!stdout.startsWith(`${name} version ${receipt.version} `))
        throw new Error(`Bundled ${name} version differs`);
      const config = stdout
        .split("\n")
        .find((line) => line.startsWith("configuration: "))
        ?.slice(15);
      if (!config || !config.includes("--disable-gpl") || !config.includes("--disable-nonfree"))
        throw new Error(`Bundled ${name} license configuration differs`);
      if (configuration && configuration !== config)
        throw new Error("Bundled tool configurations differ");
      configuration = config;
    }
    return {
      available: true,
      directory,
      receiptSha256,
      version: receipt.version,
      configuration,
      recipeSha256: receipt.recipeSha256,
      sourceSha256: receipt.sourceSha256,
      executables,
    };
  } catch (error) {
    return {
      available: false,
      code: "FFMPEG_UNAVAILABLE",
      message: (error instanceof Error ? error.message : String(error)).slice(0, 1000),
    };
  }
}
