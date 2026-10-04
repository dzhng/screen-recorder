import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { redact } from "./auth.mjs";

export async function runContainer({
  image,
  request,
  files = {},
  auth = { env: {}, secrets: [] },
  network = true,
  timeoutMs = 180000,
}) {
  const scratch = await mkdtemp(join(tmpdir(), "screenrec-eval-"));
  const name = `screenrec-eval-${randomUUID()}`;
  const input = {
    ...files,
    ...auth.files,
    "request.json": JSON.stringify(request),
    "work/.keep": "",
  };
  try {
    for (const [path, value] of Object.entries(input)) {
      await mkdir(dirname(join(scratch, path)), { recursive: true });
      await writeFile(join(scratch, path), value, { mode: 0o600 });
    }
    const args = [
      "run",
      "--rm",
      "-i",
      "--name",
      name,
      "--read-only",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges",
      "--memory",
      "1g",
      "--cpus",
      "1",
      "--tmpfs",
      "/sandbox:rw,nosuid,nodev,mode=1777,size=256m",
      "--tmpfs",
      "/tmp:rw,nosuid,nodev,mode=1777,size=128m",
    ];
    if (!network) args.push("--network", "none");
    for (const key of Object.keys(auth.env)) args.push("--env", key);
    args.push(image);
    const child = spawn("docker", args, {
      env: { ...process.env, ...auth.env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const tar = spawn("tar", ["--no-xattrs", "-C", scratch, "-cf", "-", ...Object.keys(input)], {
      env: { ...process.env, COPYFILE_DISABLE: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    tar.stdout.pipe(child.stdin);
    child.stdin.on("error", () => {});
    let stdout = "",
      stderr = "",
      tarError = "",
      timedOut = false;
    child.stdout.on("data", (bytes) => (stdout += bytes));
    child.stderr.on("data", (bytes) => (stderr += bytes));
    tar.stderr.on("data", (bytes) => (tarError += bytes));
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
      tar.kill("SIGKILL");
    }, timeoutMs);
    const ended = (process) =>
      new Promise((resolve, reject) => {
        process.once("close", resolve);
        process.once("error", reject);
      });
    let exit, tarExit;
    try {
      [exit, tarExit] = await Promise.all([ended(child), ended(tar)]);
    } finally {
      clearTimeout(timer);
      child.kill("SIGKILL");
      tar.kill("SIGKILL");
    }
    const logs = redact({ stdout, stderr, tarError }, auth.secrets);
    if (timedOut) return { error: `Container timed out after ${timeoutMs}ms`, ...logs };
    if (tarExit !== 0) return { error: "Container input transfer failed", ...logs };
    try {
      const result = JSON.parse(logs.stdout.trim());
      if (exit !== 0 && !result.error) result.error = `Docker container exited ${exit}`;
      return { ...result, containerExit: exit, containerDiagnostics: logs.stderr };
    } catch {
      return { error: `Container exited ${exit} without an eval result`, ...logs };
    }
  } finally {
    try {
      execFileSync("docker", ["rm", "--force", name], { stdio: "ignore", timeout: 10000 });
    } catch {}
    await rm(scratch, { recursive: true, force: true });
  }
}
