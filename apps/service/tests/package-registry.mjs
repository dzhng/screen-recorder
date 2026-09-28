import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { constants, readSync, fstatSync } from "node:fs";
import {
  mkdtemp,
  realpath,
  mkdir,
  open,
  writeFile,
  readFile,
  readdir,
  rm,
  stat,
  chmod,
  truncate,
} from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { RevisionStore } from "../../../packages/core/dist/library.js";
import { JobQueue, recordingJobTargets } from "../../../packages/core/dist/jobs.js";
import { archiveLimits } from "../../../packages/core/dist/package-archive.js";
import { archiveContents } from "../../macos/tests/fixtures/archive-contents.mjs";
import { PackageRegistry } from "../dist/package-registry.js";
import { DerivativeDelivery } from "../dist/delivery.js";
import { mediaWorker } from "../dist/worker.js";

const native = process.env.SCREENREC_NATIVE;
assert.ok(native, "SCREENREC_NATIVE must select the built native executable");
const worker = mediaWorker({ SCREENREC_NATIVE: native });
async function fixture(t, options = {}) {
  const home = await realpath(await mkdtemp("/tmp/screenrec-registry-"));
  const directory = join(home, "packages");
  await mkdir(directory, { mode: 0o700 });
  const handle = await open(
    directory,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  );
  const store = new RevisionStore(join(home, "library.sqlite"), {
    now: () => "fixture",
    newId: randomUUID,
  });
  const jobs = new JobQueue({
    store,
    targets: recordingJobTargets(store),
    providers: { newId: randomUUID },
    execute: async () => "library",
  });
  const delivery = new DerivativeDelivery();
  const registry = new PackageRegistry({
    parent: { directory, handle },
    jobs,
    delivery,
    worker,
    limits: { ...archiveLimits, expandedBytes: 1024 ** 2 },
    ...options,
  });
  const files = archiveContents(),
    input = join(home, "input.zip");
  async function writeArchive() {
    await writeFile(join(home, "files.json"), JSON.stringify(files));
    execFileSync("/usr/bin/python3", [
      fileURLToPath(new URL("../../macos/tests/fixtures/package-archive.py", import.meta.url)),
      join(home, "files.json"),
      input,
      "valid",
    ]);
  }
  await writeArchive();
  t.after(async () => {
    await registry.dispose();
    await jobs.close();
    delivery.dispose();
    store.close();
    await handle.close();
    await rm(home, { recursive: true, force: true });
  });
  return { home, directory, handle, store, jobs, delivery, registry, input, files, writeArchive };
}
async function waitFor(read, predicate) {
  const deadline = Date.now() + 5000;
  let value;
  while (Date.now() < deadline) {
    value = read();
    if (predicate(value)) return value;
    await setTimeout(1);
  }
  assert.fail(`State did not settle: ${JSON.stringify(value)}`);
}
const ready = (f, id) =>
  waitFor(
    () => f.registry.status(id),
    (value) => value.state === "ready" || ["failed", "cleanup_failed"].includes(value.state),
  ).then((value) => {
    assert.equal(value.state, "ready", JSON.stringify(value));
    return value.packageHandle;
  });

test("registry reserves before extraction, charges copied bytes, and closes without library rows", async (t) => {
  const f = await fixture(t);
  await assert.rejects(f.registry.open(f.input), { code: "PROCESSING_BUSY" });
  await f.registry.recover();
  const bytes = (await stat(f.input)).size;
  const admission = await f.registry.open(f.input);
  assert.equal(admission.packageHandle, null);
  assert.equal(f.registry.usage().budgetBytes, bytes + 1024 ** 2 + 128 * 1024 ** 2);
  const handle = await ready(f, admission.id),
    context = f.registry.lookup(handle);
  const expanded = Object.values(f.files).reduce((sum, value) => sum + Buffer.byteLength(value), 0);
  assert.deepEqual(context.archiveUsage, { copiedBytes: bytes, expandedBytes: expanded });
  assert.equal(f.registry.usage().budgetBytes, bytes + expanded + 128 * 1024 ** 2);
  assert.equal(f.registry.usage().confirmedBytes, bytes + expanded);
  assert.equal(f.store.catalog.prepare("SELECT COUNT(*) AS n FROM recordings").get().n, 0);
  await f.registry.close(admission.id);
  assert.equal(f.registry.status(admission.id).state, "closed");
  assert.deepEqual(await readdir(f.directory), []);
  assert.equal(f.registry.usage().budgetBytes, 0);
  assert.throws(() => f.registry.lookup(handle), { code: "CONTEXT_CLOSED" });
  assert.throws(() => context.files.open("source/video.mov"), { code: "CONTEXT_CLOSED" });
  await f.registry.close(admission.id);
  await f.registry.dispose();
  await assert.rejects(f.registry.open(f.input), { code: "SERVICE_STOPPED" });
  await assert.rejects(f.registry.recover(), { code: "SERVICE_STOPPED" });
});

test("64 GiB admission pool rejects two maximum sparse inputs before extraction and releases canceled queue work", async (t) => {
  const f = await fixture(t, { limits: archiveLimits });
  await f.registry.recover();
  f.store.allocate(); // An unsettled generated take keeps the shared heavy lane paused.
  await truncate(f.input, 16 * 1024 ** 3);
  const first = await f.registry.open(f.input);
  assert.equal(f.registry.status(first.id).state, "queued");
  assert.equal(f.registry.usage().budgetBytes, 32 * 1024 ** 3 + 128 * 1024 ** 2);
  await assert.rejects(f.registry.open(f.input), { code: "LIMIT_EXCEEDED" });
  assert.equal(f.registry.usage().owners, 1);
  assert.deepEqual(await readdir(f.directory), []);
  await f.registry.close(first.id);
  assert.equal(f.registry.status(first.id).state, "canceled");
  assert.equal(f.registry.usage().budgetBytes, 0);
  const later = await f.registry.open(f.input);
  await f.registry.close(later.id);
});

test("four same-content resource owners stay independent and failed close retains its slot and charge", async (t) => {
  const f = await fixture(t);
  await f.registry.recover();
  const admissions = await Promise.all(Array.from({ length: 4 }, () => f.registry.open(f.input)));
  const handles = await Promise.all(admissions.map((value) => ready(f, value.id)));
  assert.equal(new Set(handles).size, 4);
  const before = f.registry.usage();
  await assert.rejects(f.registry.open(f.input), { code: "LIMIT_EXCEEDED" });
  const directory = join(f.directory, admissions[0].id);
  await chmod(directory, 0o500);
  try {
    const closing = f.registry.close(admissions[0].id);
    assert.equal(f.registry.close(admissions[0].id), closing);
    assert.throws(() => f.registry.lookup(handles[0]), { code: "CONTEXT_CLOSED" });
    await assert.rejects(closing, { code: "ARCHIVE_CLEANUP_FAILED" });
    assert.equal(f.registry.status(admissions[0].id).state, "cleanup_failed");
    assert.equal(f.registry.usage().owners, 4);
    assert.equal(f.registry.usage().budgetBytes, before.budgetBytes);
    await assert.rejects(f.registry.open(f.input), { code: "LIMIT_EXCEEDED" });
    const sibling = f.registry.lookup(handles[1]).files.open("source/video.mov");
    assert.ok(sibling.fd >= 0);
    sibling.close();
  } finally {
    await chmod(directory, 0o700);
  }
  await f.registry.close(admissions[0].id);
  assert.equal(f.registry.usage().owners, 3);
  assert.equal(f.registry.usage().budgetBytes, (before.budgetBytes * 3) / 4);
  const replacement = await f.registry.open(f.input);
  const replacementHandle = await ready(f, replacement.id);
  assert.notEqual(replacementHandle, handles[0]);
  assert.throws(() => f.registry.lookup(handles[0]), { code: "CONTEXT_CLOSED" });
});

test("one handle makes more than 32 requests and bounded terminal receipts expire without resurrection", async (t) => {
  const f = await fixture(t);
  await f.registry.recover();
  const initial = await f.registry.open(f.input),
    handle = await ready(f, initial.id);
  for (let i = 0; i < 40; i++) {
    const job = f.registry.submit(
      handle,
      { artifact: "read", lane: "frame", input: JSON.stringify({ i }) },
      async (context) => {
        const file = context.files.open("source/video.mov");
        file.close();
        return String(i);
      },
    );
    const settled = await waitFor(
      () => f.registry.job(handle, job.jobId),
      (value) => value.state === "ready",
    );
    assert.equal(settled.result, String(i));
    f.registry.forget(handle, job.jobId);
    assert.throws(() => f.registry.job(handle, job.jobId), { code: "NOT_FOUND" });
  }
  await f.registry.close(initial.id);
  for (let i = 0; i < 32; i++) {
    const admission = await f.registry.open(f.input);
    await ready(f, admission.id);
    await f.registry.close(admission.id);
  }
  assert.equal(f.registry.usage().terminalReceipts, 32);
  assert.throws(() => f.registry.status(initial.id), { code: "NOT_FOUND" });
  assert.throws(() => f.registry.lookup(handle), { code: "CONTEXT_CLOSED" });
  await assert.rejects(f.registry.close(initial.id), { code: "NOT_FOUND" });
  assert.equal(f.registry.usage().owners, 0);
});

test("failed validation cleans up, while an unconfirmed nonempty creation keeps its reservation until explicit retry", async (t) => {
  const f = await fixture(t);
  await f.registry.recover();
  await writeFile(f.input, "not a ZIP");
  const invalid = await f.registry.open(f.input);
  await waitFor(
    () => f.registry.status(invalid.id),
    (value) => value.state === "failed",
  );
  assert.equal(f.registry.status(invalid.id).packageHandle, null);
  assert.equal(f.registry.usage().budgetBytes, 0);
  assert.deepEqual(await readdir(f.directory), []);
  let foreign;
  const g = await fixture(t, {
    worker: async (operation, params, options) => {
      const receipt = await worker(operation, params, options);
      if (operation === "packageWorkspace.create" && receipt.ok) {
        foreign = join(g.directory, params.name, "foreign");
        await writeFile(foreign, "preserve");
        return {
          ok: false,
          error: {
            code: "LOST_REPLY",
            message: "Creation reply lost",
            retryable: true,
            details: {},
          },
        };
      }
      return receipt;
    },
  });
  await g.registry.recover();
  const lost = await g.registry.open(g.input),
    budget = g.registry.usage().budgetBytes;
  await waitFor(
    () => g.registry.status(lost.id),
    (value) => value.state === "cleanup_failed",
  );
  assert.equal(g.registry.usage().budgetBytes, budget);
  assert.equal(g.registry.status(lost.id).packageHandle, null);
  assert.equal(await readFile(foreign, "utf8"), "preserve");
  await rm(foreign);
  await g.registry.close(lost.id);
  assert.equal(g.registry.status(lost.id).state, "failed");
  assert.equal(g.registry.usage().budgetBytes, 0);
  assert.deepEqual(await readdir(g.directory), []);
});

test("same-provenance library deletion and package close revoke only their own delivery namespaces", async (t) => {
  const [
    { DerivedCache, recordingCacheOwnerCheck },
    { SourceEvidenceStore, recordingEvidenceOwner },
    { SceneEvidenceStore, recordingSceneOwner },
    { ScreenshotIndexStore },
    { TranscriptStore, recordingTranscriptOwner },
    { CaptureService },
    { RecordingDeletion },
    { ManagedFiles },
  ] = await Promise.all([
    import("../../../packages/core/dist/cache.js"),
    import("../../../packages/core/dist/evidence.js"),
    import("../../../packages/core/dist/scene-evidence.js"),
    import("../../../packages/core/dist/screenshot-index.js"),
    import("../../../packages/core/dist/transcript.js"),
    import("../dist/capture.js"),
    import("../dist/deletion.js"),
    import("../dist/managed-files.js"),
  ]);
  const f = await fixture(t),
    recording = f.store.allocate().recording;
  for (const [i, state] of ["recording", "finalizing", "complete"].entries())
    f.store.ingestLifecycle(recording.recordingId, {
      sourceId: recording.sourceId,
      sequence: i + 1,
      state,
      sourceDurationUs: 100,
    });
  f.files["manifest.json"] = f.files["manifest.json"].replaceAll(
    '"take"',
    JSON.stringify(recording.recordingId),
  );
  await f.writeArchive();
  const recordingDirectory = join(f.home, "recordings", recording.recordingId);
  await mkdir(recordingDirectory, { recursive: true });
  await writeFile(join(recordingDirectory, "owned"), "library source");
  const cache = new DerivedCache(f.store, f.home, recordingCacheOwnerCheck(f.store));
  await cache.reconcile();
  const capture = new CaptureService(
    f.store,
    f.home,
    async () => {
      throw new Error("No capture device expected");
    },
    async () => {
      throw new Error("No recovery expected");
    },
  );
  const deletion = new RecordingDeletion({
    store: f.store,
    jobs: f.jobs,
    cache,
    capture,
    delivery: f.delivery,
    source: new SourceEvidenceStore(f.store, recordingEvidenceOwner(f.store)),
    scenes: new SceneEvidenceStore(f.store, recordingSceneOwner(f.store)),
    index: new ScreenshotIndexStore(f.store, f.home),
    transcripts: new TranscriptStore(f.store, f.home, recordingTranscriptOwner(f.store)),
    cleanupReady: () => Promise.resolve(),
    files: new ManagedFiles(f.home, worker),
  });
  try {
    await f.registry.recover();
    const a = await f.registry.open(f.input),
      b = await f.registry.open(f.input);
    const first = await ready(f, a.id),
      second = await ready(f, b.id);
    const lease = (handle) => {
      const file = f.registry.lookup(handle).files.open("source/video.mov");
      return {
        bytes: fstatSync(file.fd).size,
        read: (buffer, position) => readSync(file.fd, buffer, 0, buffer.length, position),
        release: () => file.close(),
      };
    };
    const target = f.delivery.open({ kind: "package", id: first }, () => lease(first));
    const sibling = f.delivery.open({ kind: "package", id: second }, () => lease(second));
    const library = f.delivery.open({ kind: "recording", id: recording.recordingId }, () =>
      lease(first),
    );
    assert.equal(f.registry.lookup(first).manifest.snapshot.recordingId, recording.recordingId);
    await deletion.delete(recording.recordingId);
    assert.throws(() => f.store.get(recording.recordingId), { code: "NOT_FOUND" });
    assert.throws(() => f.delivery.read(library.token, 0, 20), { code: "ARTIFACT_EXPIRED" });
    assert.equal(
      Buffer.from(f.delivery.read(target.token, 0, 20).data, "base64").toString(),
      "generated source",
    );
    await f.registry.close(a.id);
    assert.throws(() => f.delivery.read(target.token, 0, 20), { code: "ARTIFACT_EXPIRED" });
    assert.equal(
      Buffer.from(f.delivery.read(sibling.token, 0, 20).data, "base64").toString(),
      "generated source",
    );
  } finally {
    await deletion.close();
    await capture.close();
  }
});

test("startup remains blocked by a killed owner's actual native child while library jobs continue", async (t) => {
  const { withOrphanedPackageWorkspace } =
    await import("./fixtures/orphaned-package-workspace.mjs");
  const f = await fixture(t);
  await withOrphanedPackageWorkspace(f.directory, native, async ({ name, finishChild }) => {
    await assert.rejects(f.registry.recover(), { code: "RECOVERY_BUSY", retryable: true });
    assert.equal(f.registry.usage().state, "recovery");
    await assert.rejects(f.registry.open(f.input), { code: "PROCESSING_BUSY" });
    assert.equal(
      await readFile(join(f.directory, name, "data"), "utf8"),
      "held by inherited native descriptor",
    );
    const recording = f.store.allocate().recording;
    for (const [i, state] of ["recording", "finalizing", "complete"].entries())
      f.store.ingestLifecycle(recording.recordingId, {
        sourceId: recording.sourceId,
        sequence: i + 1,
        state,
        sourceDurationUs: 100,
      });
    const job = f.jobs.submit({
      target: { kind: "recording", recordingId: recording.recordingId },
      artifact: "library",
      lane: "heavy",
      input: "{}",
    });
    assert.equal(
      (
        await waitFor(
          () => f.jobs.job(job.jobId),
          (value) => value.state === "ready",
        )
      ).state,
      "ready",
    );
    await finishChild();
    await f.registry.recover();
    assert.equal(f.registry.usage().state, "ready");
    assert.deepEqual(await readdir(f.directory), []);
    const admission = await f.registry.open(f.input);
    await ready(f, admission.id);
  });
});

test("close fences delivery and drains an actual native media worker before removing its directory", async (t) => {
  let marker,
    library,
    directory,
    workerClosed = false,
    nativeStarted = false;
  const wrapped = async (operation, params, options) => {
    if (nativeStarted && ["archive.cleanup", "packageWorkspace.remove"].includes(operation))
      assert.equal(workerClosed, true, "Directory cleanup must follow actual worker closure");
    if (operation !== "media.frame") return worker(operation, params, options);
    const previousLibrary = process.env.DYLD_INSERT_LIBRARIES,
      previousMarker = process.env.SCREENREC_TEST_NATIVE_HELD;
    process.env.DYLD_INSERT_LIBRARIES = library;
    process.env.SCREENREC_TEST_NATIVE_HELD = marker;
    let pending;
    try {
      pending = worker(operation, params, { ...options, timeoutMs: 5000 });
      nativeStarted = true;
    } finally {
      if (previousLibrary === undefined) delete process.env.DYLD_INSERT_LIBRARIES;
      else process.env.DYLD_INSERT_LIBRARIES = previousLibrary;
      if (previousMarker === undefined) delete process.env.SCREENREC_TEST_NATIVE_HELD;
      else process.env.SCREENREC_TEST_NATIVE_HELD = previousMarker;
    }
    const result = await pending;
    assert.ok(
      (await stat(directory)).isDirectory(),
      "Directory remains until worker pipe closure is observed",
    );
    workerClosed = true;
    return result;
  };
  const f = await fixture(t, { worker: wrapped });
  marker = join(f.home, "native-held");
  library = join(f.home, "native-held.dylib");
  execFileSync("/usr/bin/clang", [
    "-dynamiclib",
    "-o",
    library,
    fileURLToPath(new URL("./fixtures/native-start-barrier.c", import.meta.url)),
  ]);
  await f.registry.recover();
  const admission = await f.registry.open(f.input),
    handle = await ready(f, admission.id);
  directory = join(f.directory, admission.id);
  const file = f.registry.lookup(handle).files.open("source/video.mov");
  const delivery = f.delivery.open({ kind: "package", id: handle }, () => ({
    bytes: fstatSync(file.fd).size,
    read: (buffer, position) => readSync(file.fd, buffer, 0, buffer.length, position),
    release: () => file.close(),
  }));
  f.registry.submit(
    handle,
    { artifact: "held-native", lane: "frame", input: "{}" },
    async (context, signal) =>
      JSON.stringify(
        await context.run(
          "media.frame",
          {
            source: "source/video.mov",
            output: "held",
            atSourceUs: 0,
            kept: { startUs: 0, endUs: 100 },
            overlay: null,
          },
          signal,
        ),
      ),
  );
  let pid;
  try {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const value = await readFile(marker, "utf8").catch((error) => {
        if (error.code === "ENOENT") return "";
        throw error;
      });
      if (value) {
        pid = Number(value);
        break;
      }
      await setTimeout(1);
    }
    assert.ok(pid, "Actual native media worker must report its inherited descriptors");
    assert.equal(
      execFileSync("/bin/ps", ["-p", String(pid), "-o", "ppid=,command="], {
        encoding: "utf8",
      }).trim(),
      `${process.pid} ${native}`,
    );
    await waitFor(
      () =>
        execFileSync("/bin/ps", ["-p", String(pid), "-o", "state="], { encoding: "utf8" }).trim(),
      (value) => value.startsWith("T"),
    );
    const closing = f.registry.close(admission.id);
    assert.throws(() => f.registry.lookup(handle), { code: "CONTEXT_CLOSED" });
    assert.equal(
      Buffer.from(f.delivery.read(delivery.token, 0, 20).data, "base64").toString(),
      "generated source",
    );
    await closing;
    assert.equal(workerClosed, true);
    assert.throws(
      () => process.kill(pid, 0),
      (error) => error.code === "ESRCH",
    );
    assert.throws(() => f.delivery.read(delivery.token, 0, 20), { code: "ARTIFACT_EXPIRED" });
    assert.equal(f.registry.usage().budgetBytes, 0);
    assert.deepEqual(await readdir(f.directory), []);
  } finally {
    await f.registry.close(admission.id);
  }
});

test("correctly hashed malformed payload is admitted structurally and rejected by the shared lazy reader", async (t) => {
  const [{ FileSourceEvidence }, { evidenceIndexes }, { fileSubdirectory }] = await Promise.all([
    import("../../../packages/core/dist/evidence-pages.js"),
    import("../../../packages/core/dist/evidence-read.js"),
    import("../../../packages/core/dist/files.js"),
  ]);
  const f = await fixture(t),
    identity = {
      owner: { kind: "recording", recordingId: "take" },
      sourceId: "source",
      generation: "source-1",
    };
  const hash = (value) => createHash("sha256").update(value).digest("hex");
  const page = JSON.stringify([
    {
      sequence: 1,
      event: "cursorSample",
      sourceUs: 1,
      content: JSON.stringify({ sourceUs: 1, x: "invalid" }),
    },
  ]);
  const indexes = Object.fromEntries(evidenceIndexes.map((name) => [name, []]));
  indexes.cursor = [
    {
      file: "1.json",
      first: [1, 1],
      last: [1, 1],
      rows: 1,
      bytes: Buffer.byteLength(page),
      sha256: hash(page),
    },
  ];
  delete f.files["evidence/source.jsonl"];
  f.files["evidence/source/1.json"] = page;
  f.files["evidence/source/pages.json"] = JSON.stringify({
    version: 1,
    metadata: { kind: "source", identity },
    indexes,
  });
  const manifest = JSON.parse(f.files["manifest.json"]),
    paths = ["evidence/source/1.json", "evidence/source/pages.json"];
  manifest.inventory = manifest.inventory.filter((item) => item.role !== "source");
  manifest.inventory.push(
    ...paths.map((path) => ({
      path,
      role: "source",
      bytes: Buffer.byteLength(f.files[path]),
      sha256: hash(f.files[path]),
    })),
  );
  manifest.evidence.find((item) => item.artifact.reference.kind === "source").files = paths;
  f.files["manifest.json"] = JSON.stringify(manifest);
  await f.writeArchive();
  await f.registry.recover();
  const admission = await f.registry.open(f.input),
    handle = await ready(f, admission.id);
  const reader = new FileSourceEvidence(
    fileSubdirectory(f.registry.lookup(handle).files, "evidence/source"),
    identity,
  );
  assert.throws(() => reader.page({ ...identity, range: { startUs: 0, endUs: 100 } }), {
    code: "INVALID_EVIDENCE",
  });
  assert.equal(f.registry.status(admission.id).state, "ready");
});

test("default peak reservations block a fourth pending open but validated steady bytes allow it", async (t) => {
  const f = await fixture(t, { limits: archiveLimits });
  await f.registry.recover();
  const capture = f.store.allocate().recording;
  const admissions = [];
  for (let i = 0; i < 3; i++) admissions.push(await f.registry.open(f.input));
  assert.equal(
    f.registry.usage().budgetBytes,
    3 * ((await stat(f.input)).size + 16 * 1024 ** 3 + 128 * 1024 ** 2),
  );
  await assert.rejects(f.registry.open(f.input), { code: "LIMIT_EXCEEDED" });
  f.store.ingestLifecycle(capture.recordingId, {
    sourceId: capture.sourceId,
    sequence: 1,
    state: "canceled",
  });
  f.jobs.schedule();
  await Promise.all(admissions.map((value) => ready(f, value.id)));
  const fourth = await f.registry.open(f.input);
  await ready(f, fourth.id);
  assert.equal(f.registry.usage().owners, 4);
  assert.ok(f.registry.usage().budgetBytes < 1024 ** 3);
});

test("failed context work can retry and canceled queued work never consumes execution", async (t) => {
  const f = await fixture(t);
  await f.registry.recover();
  const admission = await f.registry.open(f.input),
    handle = await ready(f, admission.id);
  let attempts = 0;
  const job = f.registry.submit(
    handle,
    { artifact: "retry", lane: "frame", input: "{}" },
    async () => {
      if (++attempts === 1) throw new Error("generated failure");
      return "retried";
    },
  );
  await waitFor(
    () => f.registry.job(handle, job.jobId),
    (value) => value.state === "failed",
  );
  f.registry.retry(handle, job.jobId);
  assert.equal(
    (
      await waitFor(
        () => f.registry.job(handle, job.jobId),
        (value) => value.state === "ready",
      )
    ).result,
    "retried",
  );
  assert.equal(attempts, 2);
  f.registry.forget(handle, job.jobId);
  const started = Promise.withResolvers(),
    finish = Promise.withResolvers();
  const active = f.registry.submit(
    handle,
    { artifact: "held", lane: "heavy", input: "{}" },
    async () => {
      started.resolve();
      await finish.promise;
      return "done";
    },
  );
  await started.promise;
  try {
    const queued = f.registry.submit(
      handle,
      { artifact: "canceled", lane: "frame", input: "{}" },
      async () => {
        throw new Error("Canceled work must not execute");
      },
    );
    assert.equal(queued.state, "queued");
    assert.equal(f.registry.cancel(handle, queued.jobId).state, "canceled");
    f.registry.forget(handle, queued.jobId);
  } finally {
    finish.resolve();
  }
  await waitFor(
    () => f.registry.job(handle, active.jobId),
    (value) => value.state === "ready",
  );
});

test("partial copy cancellation drains the actual worker before returning reservation and removing its tree", async (t) => {
  const { withArchiveCopyBarrier } =
    await import("../../macos/tests/fixtures/archive-copy-barrier.mjs");
  let selectedWorker = worker;
  const f = await fixture(t, { worker: (...args) => selectedWorker(...args) });
  f.files["source/video.mov"] = "generated source".repeat(20_000);
  const manifest = JSON.parse(f.files["manifest.json"]),
    video = manifest.inventory.find((item) => item.role === "video");
  video.bytes = Buffer.byteLength(f.files["source/video.mov"]);
  video.sha256 = createHash("sha256").update(f.files["source/video.mov"]).digest("hex");
  f.files["manifest.json"] = JSON.stringify(manifest);
  await f.writeArchive();
  const input = await readFile(f.input);
  await f.registry.recover();
  await withArchiveCopyBarrier(
    f.home,
    native,
    { partial: true },
    async ({ worker: heldWorker, held, drain }) => {
      let copying = false,
        copyClosed = false;
      selectedWorker = async (operation, params, options) => {
        if (copying && ["archive.cleanup", "packageWorkspace.remove"].includes(operation))
          assert.equal(copyClosed, true, "Copy worker closes before directory cleanup");
        if (operation !== "archive.extract") return heldWorker(operation, params, options);
        copying = true;
        try {
          return await heldWorker(operation, params, options);
        } finally {
          copyClosed = true;
        }
      };
      const admission = await f.registry.open(f.input);
      const completion = drain(
        waitFor(
          () => f.registry.status(admission.id),
          (value) => !["queued", "opening", "closing"].includes(value.state),
        ),
      );
      try {
        await held;
        const copied = (await stat(join(f.directory, admission.id, ".input"))).size;
        assert.ok(copied > 0 && copied < input.length);
        assert.equal(f.registry.status(admission.id).packageHandle, null);
        assert.equal(f.registry.usage().budgetBytes, input.length + 1024 ** 2 + 128 * 1024 ** 2);
        await f.registry.close(admission.id);
        assert.equal(copyClosed, true);
        assert.equal((await completion).state, "canceled");
        assert.equal(f.registry.usage().budgetBytes, 0);
        assert.deepEqual(await readdir(f.directory), []);
        assert.deepEqual(await readFile(f.input), input);
      } finally {
        try {
          await f.registry.close(admission.id);
        } finally {
          selectedWorker = worker;
          await Promise.allSettled([completion]);
        }
      }
    },
  );
});
