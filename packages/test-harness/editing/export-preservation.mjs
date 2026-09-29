import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { chmod, mkdir, readFile, readdir, realpath, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { parseArgs } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { cliReply } from "./first-preview-transport.mjs";
import { hash, root, run } from "./source-evidence-fixture.mjs";

const { values } = parseArgs({
  options: {
    out: { type: "string" },
    baseline: { type: "string" },
    presentation: { type: "string" },
    "legacy-app": { type: "string" },
    "original-home": { type: "string" },
    python: { type: "string" },
  },
});
assert(
  values.out &&
    values.baseline &&
    values.presentation &&
    values["legacy-app"] &&
    values["original-home"] &&
    values.python &&
    process.env.SCREENREC_NATIVE,
);
const baseline = JSON.parse(await readFile(values.baseline, "utf8"));
const presentation = JSON.parse(await readFile(values.presentation, "utf8"));
assert(baseline.passed && presentation.passed);
assert.equal(hash(await readFile(process.env.SCREENREC_NATIVE)), baseline.nativeSha256);
for (const [path, digest] of Object.entries(baseline.legacyIdentities))
  assert.equal(hash(await readFile(path)), digest);
const app = await realpath(values["legacy-app"]),
  original = await realpath(values["original-home"]);
const configured = JSON.parse(
  await readFile(join(app, "Contents/Resources/service/runtime.json"), "utf8"),
);
assert.equal(await realpath(configured.nodePath), await realpath(process.execPath));
await mkdir(values.out, { mode: 0o700 });
const out = await realpath(values.out);
const profile = join(out, "readonly.sb");
await writeFile(
  profile,
  `(version 1)\n(allow default)\n(deny file-write* (subpath ${JSON.stringify(original)}) (subpath ${JSON.stringify(app)}))\n`,
);
const proxy = join(out, "native-observer");
await writeFile(
  proxy,
  `#!${await realpath(values.python)}\n` +
    (await readFile(join(root, "packages/test-harness/editing/publication-observer.py"), "utf8")),
);
await chmod(proxy, 0o700);
const report = {
  passed: false,
  scope:
    "One cached matched postcommit acknowledgement-loss/restart with concurrent identity replay",
  attempts: [],
  sides: [],
  processes: [],
  checks: {},
  baseline: {
    path: values.baseline,
    sha256: hash(await readFile(values.baseline)),
    presentation: values.presentation,
    presentationSha256: hash(await readFile(values.presentation)),
  },
  nativeSha256: baseline.nativeSha256,
};
let active;
const released = new Set();
async function until(read, done, label, ms = 30000) {
  const deadline = Date.now() + ms;
  for (;;) {
    const value = await read();
    if (done(value)) return value;
    assert(Date.now() < deadline, `${label}: deadline`);
    await delay(20);
  }
}
async function file(path) {
  const bytes = await readFile(path),
    s = await stat(path, { bigint: true });
  return { bytes: bytes.length, sha256: hash(bytes), dev: String(s.dev), ino: String(s.ino) };
}
async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
async function present(path) {
  try {
    return await json(path);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
}
async function start(side) {
  const modern = side.side === "project";
  const entry = modern
    ? join(root, "packages/test-harness/editing/source-acquisition-service.mjs")
    : join(app, "Contents/Resources/service/main.mjs");
  const child = spawn(
    "/usr/bin/sandbox-exec",
    ["-f", profile, process.execPath, entry, ...(modern ? [side.home] : [])],
    {
      cwd: "/",
      env: {
        ...process.env,
        SCREENREC_HOME: side.home,
        SCREENREC_NATIVE: proxy,
        SCREENREC_REAL_NATIVE: side.native,
        SCREENREC_PUBLICATION_OBSERVER: side.observer,
      },
      stdio: modern ? ["pipe", "pipe", "pipe", "ipc"] : ["pipe", "pipe", "pipe"],
    },
  );
  const exit = once(child, "exit");
  let stdout = "",
    stderr = "",
    ready;
  child.stdout.on("data", (b) => (stdout += b));
  child.stderr.on("data", (b) => (stderr += b));
  if (modern)
    child.on("message", (m) => {
      if (m.socketPath || m.error) ready = m;
    });
  active = { child, exit, side, logs: () => ({ stdout, stderr }) };
  report.processes.push({ side: side.side, pid: child.pid, entry });
  await until(
    () => {
      assert.equal(child.exitCode, null, stdout + stderr);
      if (!modern)
        ready = stdout
          .split("\n")
          .filter(Boolean)
          .map((s) => JSON.parse(s))
          .find((m) => m.event === "started");
      assert(!ready?.error, JSON.stringify(ready));
      return ready;
    },
    (v) => !!v?.socketPath,
    "service startup",
  );
  active.socket = ready.socketPath;
  if (!modern) {
    const health = await call("service.health", {});
    assert.equal(await realpath(health.home), side.home);
  }
}
async function call(operation, params, error = false) {
  const entry =
    active.side.side === "project"
      ? join(root, "apps/cli/dist/main.js")
      : join(app, "Contents/Resources/cli/main.mjs");
  const response = await cliReply([
    entry,
    operation,
    "--socket",
    active.socket,
    "--params",
    JSON.stringify(params),
  ]);
  report.attempts.push({ side: active.side.side, operation, params, response });
  assert.equal(response.ok, !error, JSON.stringify(response));
  return response.ok ? response.data : response.error;
}
async function stop(crash = false) {
  if (!active) return;
  const owned = active;
  active = undefined;
  const child = owned.child;
  let timer;
  let completion = [child.exitCode, child.signalCode];
  try {
    if (child.exitCode === null && child.signalCode === null) {
      if (crash) child.kill("SIGKILL");
      else if (owned.side.side === "project") child.send("close", () => {});
      else child.stdin.end();
      completion = await Promise.race([
        owned.exit,
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            child.kill("SIGKILL");
            reject(Error("service close deadline"));
          }, 15000);
        }),
      ]);
    }
    const [code, signal] = completion;
    assert(crash ? signal === "SIGKILL" : code === 0);
    report.processes.push({ pid: child.pid, exitCode: code, signal });
  } finally {
    clearTimeout(timer);
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      await owned.exit;
    }
    await writeFile(
      join(out, `${owned.side.side}-${child.pid}-service.json`),
      JSON.stringify(owned.logs()),
    );
  }
}
async function release(side) {
  const hit = await present(join(side.observer, "hit.json"));
  if (!hit || released.has(hit.proxyPid)) return;
  if (!alive(hit.proxyPid)) {
    released.add(hit.proxyPid);
    report.processes.push({
      pid: hit.proxyPid,
      closed: true,
      method: "exit observed after service shutdown",
    });
    return;
  }
  assert(!active, "Never release withheld reply while service can acknowledge it");
  await writeFile(join(side.observer, "release"), "close without forwarding");
  await until(
    () => present(join(side.observer, "proxy-closed.json")),
    (v) => !!v,
    "proxy descriptor close",
  );
  await until(
    () => alive(hit.proxyPid),
    (v) => !v,
    "proxy process exit",
  );
  released.add(hit.proxyPid);
  report.processes.push({
    pid: hit.proxyPid,
    closed: true,
    method:
      "native child reaped by proxy; proxy descriptors closed and exit observed after service death",
  });
}
try {
  const oldExport = baseline.exports.find((x) => x.side === "legacy").receipt;
  const sides = [
    {
      side: "recording",
      home: baseline.homes.old,
      native: join(app, "Contents/MacOS/screenrec-native"),
      selection: { recordingId: oldExport.recordingId, revisionId: oldExport.snapshot.revisionId },
      expected: oldExport.receipt,
      existingExportId: oldExport.exportId,
    },
    {
      side: "project",
      home: baseline.homes.new,
      native: process.env.SCREENREC_NATIVE,
      selection: {
        projectId: presentation.project.revision.projectId,
        revisionId: presentation.project.revision.id,
      },
      expected: presentation.export.receipt,
      existingExportId: presentation.export.exportId,
    },
  ];
  for (const side of sides) {
    side.home = await realpath(side.home);
    side.observer = join(out, side.side + "-native");
    await mkdir(side.observer, { mode: 0o700 });

    const catalog = new DatabaseSync(
      join(side.home, side.side === "project" ? "library/catalog.sqlite" : "library.sqlite"),
      { readOnly: true },
    );
    try {
      const preview = JSON.parse(
        catalog
          .prepare("SELECT preview FROM export_intents WHERE exportId=?")
          .get(side.existingExportId).preview,
      );
      side.cache = join(
        side.home,
        side.side === "project" ? "library/cache/derived" : "cache/derived",
        preview.cacheId + ".cache",
      );
      assert.equal(
        catalog
          .prepare("SELECT count(*) n FROM jobs WHERE state IN ('queued','running','waiting')")
          .get().n,
        0,
      );
    } finally {
      catalog.close();
    }
    const cached = await file(side.cache);
    assert.equal(cached.sha256, side.expected.sha256);
    assert.equal(cached.bytes, side.expected.bytes);
    const leaf = side.side + ".mp4",
      exportId = randomUUID(),
      request = { ...side.selection, exportId, kind: "video", directory: out, leaf };
    const result = { side: side.side, native: side.native, cache: side.cache, request, cached };
    report.sides.push(result);
    await writeFile(join(side.observer, "arm.json"), JSON.stringify({ leaf }));
    await start(side);
    const [first, second] = await Promise.all([
      call("export.create", request),
      call("export.create", request),
    ]);
    assert.equal(first.jobId, second.jobId);
    assert.equal(first.snapshot.revisionId, side.selection.revisionId);
    assert.deepEqual(first.snapshot, second.snapshot);
    result.created = first;
    result.concurrentReplay = second;
    const hit = await until(
      () => present(join(side.observer, "hit.json")),
      (v) => !!v,
      "real native commit",
    );
    result.hit = hit;
    assert.equal(hit.nativeExitCode, 0);
    assert(!alive(hit.nativePid), "Native child must be reaped before fault");
    const committed = await file(join(out, leaf));
    assert.equal(committed.sha256, side.expected.sha256);
    assert.equal(committed.sha256, hit.prepared.sha256);
    assert.equal(committed.bytes, hit.prepared.bytes);
    assert.deepEqual({ dev: committed.dev, ino: committed.ino }, hit.prepared.file);
    result.beforeCrash = committed;
    const unacknowledged = await call("export.status", { exportId });
    assert.equal(unacknowledged.receipt, null);
    assert.equal(unacknowledged.output, null);
    assert.equal(unacknowledged.state, "running");
    result.unacknowledged = unacknowledged;
    const conflict = await call("export.create", { ...request, leaf: "conflict-" + leaf }, true);
    assert.equal(conflict.code, "REQUEST_CONFLICT");
    result.conflict = conflict;
    await stop(true);
    await release(side);
    await start(side);
    result.recovery = await call("export.recover", { exportId });
    result.recovered = await until(
      () => call("export.status", { exportId }),
      (v) => v.state === "committed",
      "recovery commit",
    );
    assert.deepEqual(result.recovered.receipt, hit.prepared);
    assert.deepEqual(result.recovered.snapshot, first.snapshot);
    assert.deepEqual(await file(join(out, leaf)), committed);
    result.retried = await call("export.retry", { exportId });
    result.replayed = await call("export.create", request);
    assert.deepEqual(result.retried.receipt, hit.prepared);
    assert.deepEqual(result.replayed.snapshot, first.snapshot);
    assert.deepEqual(await file(join(out, leaf)), committed);
    await stop();
    const names = await readdir(side.observer);
    assert(!names.some((n) => n.endsWith(".forbidden.json")), "Media/model work attempted");
    const calls = await Promise.all(
      names.filter((n) => n.endsWith(".finished.json")).map((n) => json(join(side.observer, n))),
    );
    assert.equal(calls.filter((c) => c.operation === "publication.commit").length, 1);
    assert(calls.every((c) => c.nativeExitCode === 0));
    assert(!names.includes("hold-timeout.json"), "Fixture hold watchdog fired");
    const prepared = calls.filter((c) => c.operation === "publication.prepare");
    assert.equal(prepared.length, 1);
    const sourceDescriptor = prepared[0].descriptors.find((x) => x.fd === 5);
    assert.deepEqual(
      { dev: sourceDescriptor.dev, ino: sourceDescriptor.ino },
      { dev: cached.dev, ino: cached.ino },
    );
    for (const call of calls) {
      const requestBytes = await readFile(join(side.observer, call.proxyPid + ".request"));
      const responseBytes = await readFile(join(side.observer, call.proxyPid + ".response"));
      assert.equal(hash(requestBytes), call.requestSha256);
      assert.equal(hash(responseBytes), call.responseSha256);
    }
    result.nativeCalls = calls;
    result.noSecondCommit = true;
  }
  report.passed = true;
} catch (error) {
  report.error = { message: error.message, stack: error.stack };
  throw error;
} finally {
  const closing = await Promise.allSettled([stop()]);
  report.shutdown = closing.map((x) => ({
    status: x.status,
    ...(x.status === "rejected" ? { error: String(x.reason) } : {}),
  }));
  for (const side of report.sides) {
    const observer = join(out, side.side + "-native");
    try {
      await release({ observer });
    } catch (error) {
      report.passed = false;
      report.shutdown.push({ status: "rejected", error: String(error) });
    }
  }
  for (const side of report.sides) {
    const observer = join(out, side.side + "-native");
    for (const name of (await readdir(observer)).filter((n) => n.endsWith(".started.json"))) {
      const state = await json(join(observer, name));
      if (await present(join(observer, name.replace(".started.json", ".finished.json")))) continue;
      for (const [pid, expected] of [
        [state.nativePid, side.native],
        [state.proxyPid, proxy],
      ]) {
        if (!alive(pid)) continue;
        try {
          const command = (await run("ps", ["-p", String(pid), "-o", "command="])).stdout.trim();
          assert(command.includes(expected), "Recorded process identity changed");
          process.kill(pid, "SIGKILL");
          await until(
            () => alive(pid),
            (v) => !v,
            "unfinished native/proxy exit",
          );
          report.processes.push({ pid, killed: true, reason: "incomplete observer call cleanup" });
        } catch (error) {
          report.passed = false;
          report.shutdown.push({ status: "rejected", error: String(error) });
        }
      }
    }
  }
  if (closing.some((x) => x.status === "rejected")) report.passed = false;
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
}
assert(report.passed);
console.log(JSON.stringify({ passed: true, out }));
