import assert from "node:assert/strict";
import { retainedParentDeath } from "./fixtures/retained-parent-check.mjs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { constants, fstatSync, readSync } from "node:fs";
import {
  cp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  stat,
  open,
  rename,
  symlink,
  rm,
  realpath,
} from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { registerRelocationTest, inspect } from "./package-relocation.mjs";
import { openPackageArchive } from "../../service/dist/package-archive.js";
import { mediaWorker } from "../../service/dist/worker.js";
import { fileSubdirectory } from "@screenrec/core/files";
import { FileSourceEvidence } from "@screenrec/core/evidence-pages";
import { FileSceneEvidence } from "@screenrec/core/scene-pages";
import { FileScreenshotIndex } from "@screenrec/core/index-pages";
import { parseRevisionHistory, projectEvents } from "@screenrec/core/timeline";
import { framePolicy } from "@screenrec/core/frame-materialization";
import { trailPolicy } from "@screenrec/core/trails";
import { selectionPolicy } from "@screenrec/core/selection";

const repository = fileURLToPath(new URL("../../../", import.meta.url));
const executable = resolve(
  process.env.SCREENREC_NATIVE ?? join(repository, "helpers/mac/.build/debug/screenrec-native"),
);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
function bytes(file, limit = 32 * 1024 ** 2) {
  try {
    const size = fstatSync(file.fd).size;
    assert.ok(size <= limit);
    const data = Buffer.alloc(size);
    let read = 0;
    while (read < size) {
      const count = readSync(file.fd, data, read, size - read, read);
      assert.ok(count > 0);
      read += count;
    }
    return data;
  } finally {
    file.close();
  }
}
async function files(root, prefix = "") {
  const result = [];
  for (const name of (await readdir(join(root, prefix))).sort()) {
    const path = join(prefix, name);
    if ((await stat(join(root, path))).isDirectory()) result.push(...(await files(root, path)));
    else result.push(path);
  }
  return result;
}
async function archiveFixture(original, destination) {
  const old = JSON.parse(await readFile(join(original, "context.json"), "utf8"));
  await mkdir(destination);
  await mkdir(join(destination, "source"));
  for (const name of ["video.mov", "system.mov", "capture.journal.jsonl"])
    await cp(join(original, "source", name), join(destination, "source", name));
  await mkdir(join(destination, "evidence"));
  for (const [from, to] of [
    ["source-pages", "source"],
    ["scene-pages", "scenes"],
    ["index-pages", "index"],
  ])
    await cp(join(original, from), join(destination, "evidence", to), { recursive: true });
  const source = {
    ...old.source,
    receipt: { ...old.source.receipt, file: "evidence/source/normalized.jsonl" },
  };
  await cp(join(original, "source/normalized.jsonl"), join(destination, source.receipt.file));
  await writeFile(join(destination, "evidence/source/metadata.json"), JSON.stringify(source));
  const sourceReader = new FileSourceEvidence(join(destination, "evidence/source"), source);
  assert.equal(source.receipt.header.microphone, false);
  assert.equal(sourceReader.hasAudio(source, "narration"), false);
  assert.equal(sourceReader.hasAudio(source, "system"), true);
  const revision = old.history.find((value) => value.id === old.snapshot.revisionId);
  const range = { startUs: 0, endUs: old.snapshot.sourceDurationUs };
  const events = [
    ...sourceReader.pauses(source, range).map((event) => ({ kind: "pause", ...event })),
    ...sourceReader
      .geometryChanges(source, range)
      .map((event) => ({ kind: "geometry", atSourceUs: event.sourceUs })),
    ...new FileSceneEvidence(join(destination, "evidence/scenes"), old.scenes)
      .page({ identity: old.scenes })
      .chunks.flatMap((chunk) => chunk.boundaries),
    { kind: "interruption", atSourceUs: old.snapshot.sourceDurationUs },
  ];
  await writeFile(
    join(destination, "evidence/events.json"),
    JSON.stringify(projectEvents(revision, events)),
  );
  await mkdir(join(destination, "revisions"));
  for (const value of old.history)
    await writeFile(join(destination, "revisions", `${value.id}.json`), JSON.stringify(value));
  const indexPages = JSON.parse(
    await readFile(join(destination, "evidence/index/pages.json"), "utf8"),
  );
  const coverageFiles = new Set(
    [...indexPages.indexes.coverage, ...indexPages.indexes.candidateCoverage].map(
      (page) => `evidence/index/${page.file}`,
    ),
  );
  const role = (path) =>
    path === "source/video.mov"
      ? "video"
      : path === "source/system.mov"
        ? "system"
        : path === "source/capture.journal.jsonl"
          ? "journal"
          : path.startsWith("revisions/")
            ? "revision"
            : path.startsWith("evidence/source/")
              ? "source"
              : path.startsWith("evidence/scenes/")
                ? "scenes"
                : path === "evidence/events.json"
                  ? "events"
                  : path.startsWith("evidence/index/images/")
                    ? "image"
                    : coverageFiles.has(path)
                      ? "coverage"
                      : "index";
  const inventory = await Promise.all(
    (await files(destination)).map(async (path) => {
      const content = await readFile(join(destination, path));
      return {
        path,
        role: role(path),
        bytes: content.length,
        sha256: sha(content),
        ...(["video", "system"].includes(role(path))
          ? { durationUs: old.snapshot.sourceDurationUs }
          : {}),
      };
    }),
  );
  const manifest = {
    schemaVersion: 1,
    snapshot: old.snapshot,
    acquisition: {
      recordingId: old.snapshot.recordingId,
      sourceId: old.snapshot.sourceId,
      sourceGeneration: source.generation,
      narration: "not_requested",
      system: "acquired",
    },
    inventory,
    history: old.history.map((value) => ({ id: value.id, path: `revisions/${value.id}.json` })),
    transcript: "unavailable:no_narration",
    evidence: [],
  };
  for (const [kind, generation, policy] of [
    ["source", source.generation, "native-source-v1"],
    ["scenes", old.scenes.generation, old.scenes.policy],
    ["index", old.index.generation, selectionPolicy.id],
    ["events", 1, "timeline-v1"],
  ])
    manifest.evidence.push({
      artifact: {
        reference: {
          kind,
          recordingId: old.snapshot.recordingId,
          sourceId: old.snapshot.sourceId,
          revisionId: ["source", "scenes"].includes(kind) ? "r0" : old.snapshot.revisionId,
        },
        generation,
        policy,
        options: {},
        timeDomain: ["source", "scenes"].includes(kind) ? "source" : "playback",
      },
      files: inventory
        .filter((entry) =>
          kind === "index"
            ? ["index", "coverage", "image"].includes(entry.role)
            : entry.role === kind,
        )
        .map((entry) => entry.path),
    });
  await writeFile(join(destination, "manifest.json"), JSON.stringify(manifest));
  return old.requests;
}
async function containmentChecks(archive, workspacePath, workspace, worker, native) {
  const params = {
    source: "source/video.mov",
    output: "probe",
    atSourceUs: 1_100_000,
    kept: { startUs: 0, endUs: 4_000_000 },
    overlay: null,
  };
  let context;
  const openContext = async (run = worker) =>
    (context = await openPackageArchive(
      archive,
      { directory: workspacePath, handle: workspace },
      run,
    ));
  const closed = async () => {
    await context.close();
    assert.deepEqual(await readdir(workspacePath), []);
  };
  try {
    const callerParams = structuredClone(params);
    await openContext(async (operation, input, options) => {
      if (operation === "archive.createOutput") callerParams.output = "changed-by-caller";
      return worker(operation, input, options);
    });
    await context.run("media.frame", callerParams);
    assert.throws(() => context.openOutput("changed-by-caller"), { code: "NOT_FOUND" });
    const expected = sha(bytes(context.openOutput("probe")));
    await closed();
    const sourceDirectory = join(workspacePath, "content/source");
    const foreignDirectory = join(dirname(workspacePath), "foreign-source");
    await mkdir(foreignDirectory);
    await writeFile(join(foreignDirectory, "video.mov"), "external media sentinel");
    for (const replacement of ["regular", "symlink"]) {
      await openContext();
      await rename(sourceDirectory, sourceDirectory + ".retained");
      if (replacement === "regular") {
        await mkdir(sourceDirectory);
        await cp(join(foreignDirectory, "video.mov"), join(sourceDirectory, "video.mov"));
      } else await symlink(foreignDirectory, sourceDirectory);
      await assert.rejects(context.run("media.frame", params));
      assert.equal(
        await readFile(join(foreignDirectory, "video.mov"), "utf8"),
        "external media sentinel",
      );
      await closed();
    }
    const sourcePath = join(workspacePath, "content/source/video.mov");
    let admittedInput = false;
    await openContext(async (operation, input, options) => {
      if (operation === "media.frame") {
        await rename(sourcePath, sourcePath + ".original");
        await writeFile(sourcePath, "foreign source must not be decoded");
        admittedInput = true;
      }
      return worker(operation, input, options);
    });
    await context.run("media.frame", params);
    assert.equal(sha(bytes(context.openOutput("probe"))), expected);
    assert.equal(admittedInput, true);
    assert.throws(() => context.files.open("source/video.mov"), { code: "INVALID_STORAGE" });
    await closed();
    const sentinel = join(dirname(workspacePath), "external-sentinel");
    await writeFile(sentinel, "untouched");
    let outputPath;
    await openContext(async (operation, input, options) => {
      if (operation === "media.frame") {
        await rename(outputPath, outputPath + ".original");
        await symlink(sentinel, outputPath);
      }
      const result = await worker(operation, input, options);
      if (operation === "archive.createOutput" && result.ok)
        outputPath = join(workspacePath, result.data.path);
      return result;
    });
    await assert.rejects(context.run("media.frame", params));
    assert.throws(() => context.openOutput("probe"), { code: "NOT_FOUND" });
    assert.equal(await readFile(sentinel, "utf8"), "untouched");
    await closed();
    let stopped,
      childClosed = false;
    let readyResolve;
    const ready = new Promise((resolve) => (readyResolve = resolve));
    await openContext(async (operation, input, options) => {
      if (operation === "archive.cleanup") {
        assert.equal(childClosed, true, "cleanup must follow actual native worker closure");
        assert.throws(() => process.kill(stopped, 0), { code: "ESRCH" });
      }
      const pending = worker(operation, input, options);
      if (operation !== "media.frame") return pending;
      // spawn is synchronous: inspect only the worker owned directly by this test.
      const rows = execFileSync("/bin/ps", ["-axo", "pid=,ppid=,command="], {
        encoding: "utf8",
      }).split("\n");
      const match = rows
        .map((row) => row.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/))
        .find((row) => row && Number(row[2]) === process.pid && row[3] === native);
      assert.ok(match, "actual native media process must be live at the close barrier");
      stopped = Number(match[1]);
      process.kill(stopped, "SIGSTOP");
      readyResolve();
      try {
        return await pending;
      } finally {
        childClosed = true;
      }
    });
    const held = context.files.open("source/video.mov");
    const request = context.run("media.frame", params);
    const failed = assert.rejects(
      request,
      (error) => ["CANCELED", "ABORT_ERR"].includes(error.code) || error.name === "AbortError",
    );
    try {
      await Promise.race([ready, request]);
      const closing = context.close();
      assert.equal(closing, context.close());
      assert.throws(() => context.files.open("source/video.mov"), { code: "CONTEXT_CLOSED" });
      await closing;
      await failed;
      assert.throws(() => held.fd, { code: "CONTEXT_CLOSED" });
      await closed();
    } finally {
      await context.close();
      held.close();
    }
    assert.equal(await readFile(sentinel, "utf8"), "untouched");
    return {
      admittedInputPreserved: true,
      externalOutputUnchanged: true,
      liveWorkerPid: stopped,
      workerReapedBeforeCleanup: childClosed,
      heldReadRevoked: true,
    };
  } finally {
    await context?.close();
  }
}
async function retainedReader(original, output, native) {
  const parent = await realpath(dirname(original));
  const staging = join(parent, "zip-source"),
    archive = join(parent, "fixture.zip"),
    moved = join(parent, "relocated.zip");
  const requests = await archiveFixture(original, staging);
  execFileSync("/usr/bin/python3", [
    "-c",
    "import pathlib,sys,zipfile; root=pathlib.Path(sys.argv[1]); z=zipfile.ZipFile(sys.argv[2],'w',compression=zipfile.ZIP_DEFLATED); [z.write(p,p.relative_to(root).as_posix()) for p in sorted(root.rglob('*')) if p.is_file()]; z.close()",
    staging,
    archive,
  ]);
  await rm(staging, { recursive: true });
  await rename(archive, moved);
  const before = sha(await readFile(moved));
  const unavailable = join(parent, "unavailable-portable");
  await rename(original, unavailable);
  const workspacePath = join(parent, "package-workspace");
  await mkdir(workspacePath, { mode: 0o700 });
  const workspace = await open(
    workspacePath,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  );
  let context,
    nativeCalls = 0;
  const worker = mediaWorker({ SCREENREC_NATIVE: native });
  try {
    context = await openPackageArchive(
      moved,
      { directory: workspacePath, handle: workspace },
      worker,
    );
    const source = JSON.parse(
      bytes(context.files.open("evidence/source/metadata.json"), 32768).toString(),
    );
    const manifest = context.manifest;
    const artifact = (kind) =>
      manifest.evidence.find((entry) => entry.artifact.reference.kind === kind).artifact;
    const sourceIdentity = {
      recordingId: manifest.snapshot.recordingId,
      sourceId: manifest.snapshot.sourceId,
      generation: artifact("source").generation,
    };
    assert.equal(source.generation, sourceIdentity.generation);
    const sceneIdentity = {
      ...sourceIdentity,
      generation: artifact("scenes").generation,
      policy: artifact("scenes").policy,
    };
    const indexIdentity = {
      ...sourceIdentity,
      generation: artifact("index").generation,
      revisionId: manifest.snapshot.revisionId,
      sourceIdentity,
      sceneIdentity,
      selectionPolicy: artifact("index").policy,
      framePolicy,
      trailPolicy: trailPolicy.id,
    };
    const history = parseRevisionHistory(
      manifest.history.map((entry) => JSON.parse(context.revisionContents[entry.path])),
      1000,
    );
    const revision = history.find((value) => value.id === manifest.snapshot.revisionId);
    const readers = {
      source: new FileSourceEvidence(
        fileSubdirectory(context.files, "evidence/source"),
        sourceIdentity,
      ),
      scenes: new FileSceneEvidence(
        fileSubdirectory(context.files, "evidence/scenes"),
        sceneIdentity,
      ),
      index: new FileScreenshotIndex(
        fileSubdirectory(context.files, "evidence/index"),
        indexIdentity,
        revision,
      ),
    };
    const run = async (operation, params, signal) => {
      const value = await context.run(operation, params, signal);
      nativeCalls++;
      return value;
    };
    const media = {
      run,
      decode: (params, signal) => run("media.frame", params, signal),
      sample: ({ source, kept, atSourceUs }, signal) =>
        run("media.visualSamples", { source, kept, atSourceUs }, signal),
      readOutput: async (file) => {
        const value = bytes(context.openOutput(file), 64 * 1024 ** 2);
        await writeFile(file, value);
        return value;
      },
    };
    const inspected = await inspect(
      {
        snapshot: manifest.snapshot,
        history,
        source,
        scenes: sceneIdentity,
        index: indexIdentity,
        requests,
        assets: {
          video: "source/video.mov",
          system: "source/system.mov",
          narration: "source/narration.mov",
        },
      },
      context.files.path(""),
      readers,
      media,
      output,
    );
    await writeFile(
      join(output, "result.json"),
      JSON.stringify({ result: inspected, nativeCalls }),
    );
    for (const member of manifest.inventory.filter((entry) =>
      ["video", "system", "journal"].includes(entry.role),
    ))
      assert.equal(sha(bytes(context.files.open(member.path))), member.sha256);
    const held = readers.index.openRead(indexIdentity, 0);
    const closing = context.close();
    assert.equal(closing, context.close());
    await closing;
    assert.throws(() => held.read(Buffer.alloc(1), 0));
    held.release();
    assert.throws(() => readers.index.page({ identity: indexIdentity, limit: 1 }));
    assert.throws(() =>
      readers.source.page({ ...sourceIdentity, range: { startUs: 0, endUs: 1000 } }),
    );
    assert.deepEqual(await readdir(workspacePath), []);
    assert.equal(sha(await readFile(moved)), before);
    const containment = await containmentChecks(moved, workspacePath, workspace, worker, native);
    const parentDeath = await retainedParentDeath(
      moved,
      join(parent, "orphan-workspace"),
      worker,
      native,
    );
    return {
      code: 0,
      retainedZip: true,
      closedReadRevoked: true,
      nativeCalls,
      containment,
      parentDeath,
    };
  } finally {
    await context?.close();
    await workspace.close();
    await rename(unavailable, original);
  }
}
registerRelocationTest({
  reader: retainedReader,
  narration: false,
  executable,
  evidenceScope:
    "Generated retained ZIP inspection and descriptor lifetime; no public package handle or ASR readiness claim",
});
