import { constants, openSync, closeSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  lstat,
  realpath,
  symlink,
  rename,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
const native =
  process.env.YAP_NATIVE ?? resolve(import.meta.dirname, "../.build/debug/yap-native");
async function fixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "managed-files-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  const home = join(root, "home");
  await mkdir(join(home, "cache", "derived"), { recursive: true, mode: 0o700 });
  const identity = async (path) => {
    const s = await lstat(path, { bigint: true });
    return { dev: String(s.dev), ino: String(s.ino) };
  };
  return {
    root,
    home,
    expectedHome: await identity(home),
    expectedCacheRoot: await identity(join(home, "cache", "derived")),
  };
}
function recordingDescriptor(operation, params) {
  if (operation !== "storage.removeRecordingDirectory") return undefined;
  try {
    return openSync(
      join(params.home, "recordings", params.recordingId),
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
  } catch (error) {
    if (["ENOENT", "ENOTDIR", "ELOOP"].includes(error.code)) return undefined;
    throw error;
  }
}
function call(operation, params, descriptors) {
  const fd = descriptors === undefined ? recordingDescriptor(operation, params) : undefined;
  try {
    const p = spawnSync(native, [], {
      input: JSON.stringify({ id: "storage-test", operation, params }) + "\n",
      encoding: "utf8",
      timeout: 30000,
      stdio: ["pipe", "pipe", "pipe", ...(descriptors ?? (fd === undefined ? [] : [fd]))],
    });
    assert.equal(p.error, undefined);
    assert.equal(p.status, 0, p.stderr);
    return JSON.parse(p.stdout);
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
test("recording deletion preserves sibling and model data and retries missing targets", async (t) => {
  const f = await fixture(t),
    recordingId = randomUUID(),
    sibling = randomUUID();
  for (const id of [recordingId, sibling]) {
    await mkdir(join(f.home, "recordings", id, "source"), { recursive: true, mode: 0o700 });
    await writeFile(join(f.home, "recordings", id, "source", "video.mov"), id);
  }
  await mkdir(join(f.home, "models"));
  await writeFile(join(f.home, "models", "keep"), "model");
  const params = { home: f.home, expectedHome: f.expectedHome, recordingId };
  assert.deepEqual(call("storage.removeRecordingDirectory", params).data, { removed: true });
  await assert.rejects(lstat(join(f.home, "recordings", recordingId)), { code: "ENOENT" });
  assert.equal(
    await readFile(join(f.home, "recordings", sibling, "source", "video.mov"), "utf8"),
    sibling,
  );
  assert.equal(await readFile(join(f.home, "models", "keep"), "utf8"), "model");
  assert.deepEqual(call("storage.removeRecordingDirectory", params).data, { removed: true });
});

test("cache batches remove only owned leaves, unlink leaf symlinks, and reject root replacement", async (t) => {
  const f = await fixture(t),
    a = randomUUID(),
    b = randomUUID(),
    link = randomUUID();
  const derived = join(f.home, "cache", "derived"),
    outside = join(f.root, "outside");
  await mkdir(outside);
  await writeFile(join(outside, "sentinel"), "external");
  await writeFile(join(derived, `${a}.cache`), "a");
  await writeFile(join(derived, `${b}.cache`), "b");
  await symlink(join(outside, "sentinel"), join(derived, `${link}.cache`));
  const params = {
    home: f.home,
    expectedHome: f.expectedHome,
    expectedCacheRoot: f.expectedCacheRoot,
    ids: [a, link],
  };
  assert.deepEqual(call("storage.removeCacheFiles", params).data, { removed: true });
  assert.deepEqual(call("storage.removeCacheFiles", params).data, { removed: true });
  assert.equal(await readFile(join(derived, `${b}.cache`), "utf8"), "b");
  assert.equal(await readFile(join(outside, "sentinel"), "utf8"), "external");
  assert.equal(
    call("storage.removeCacheFiles", {
      ...params,
      ids: [b],
      expectedCacheRoot: { ...f.expectedCacheRoot, ino: "18446744073709551615" },
    }).error.code,
    "INVALID_STORAGE",
  );
  assert.equal(await readFile(join(derived, `${b}.cache`), "utf8"), "b");
});

test("recording roots and ancestors cannot be symlinks; descendant links are unlinked without traversal", async (t) => {
  const f = await fixture(t),
    recordingId = randomUUID(),
    outside = join(f.root, "outside");
  await mkdir(outside);
  await writeFile(join(outside, "sentinel"), "external");
  const parent = join(f.home, "recordings"),
    target = join(parent, recordingId);
  await symlink(outside, parent);
  const params = { home: f.home, expectedHome: f.expectedHome, recordingId };
  assert.equal(call("storage.removeRecordingDirectory", params).error.code, "INVALID_STORAGE");
  await rm(parent);
  await mkdir(parent);
  await symlink(outside, target);
  assert.equal(call("storage.removeRecordingDirectory", params).error.code, "INVALID_STORAGE");
  await rm(target);
  await mkdir(target, { mode: 0o700 });
  await symlink(outside, join(target, "link"));
  assert.deepEqual(call("storage.removeRecordingDirectory", params).data, { removed: true });
  assert.equal(await readFile(join(outside, "sentinel"), "utf8"), "external");
});

test("requests reject invalid identifiers, identities, and unbounded cache batches before removal", async (t) => {
  const f = await fixture(t),
    id = randomUUID(),
    leaf = join(f.home, "cache", "derived", `${id}.cache`);
  await writeFile(leaf, "retained");
  const params = {
    home: f.home,
    expectedHome: f.expectedHome,
    expectedCacheRoot: f.expectedCacheRoot,
    ids: [id],
  };
  for (const change of [
    { ids: [] },
    { ids: Array(65).fill(id) },
    { ids: ["../escape"] },
    { extra: true },
    { expectedHome: { dev: "1", ino: 1 } },
    { expectedHome: { dev: "+1", ino: "1" } },
    { expectedHome: { dev: "1", ino: "18446744073709551616" } },
  ])
    assert.equal(
      call("storage.removeCacheFiles", { ...params, ...change }).error.code,
      "INVALID_REQUEST",
    );
  assert.equal(
    call("storage.removeCacheFiles", {
      ...params,
      expectedHome: { ...f.expectedHome, ino: "18446744073709551615" },
    }).error.code,
    "INVALID_STORAGE",
  );
  assert.equal(await readFile(leaf, "utf8"), "retained");
});

for (const cache of [false, true])
  test(`pinned ${cache ? "cache" : "recording"} directory survives an actual ancestor swap during removal`, async (t) => {
    const f = await fixture(t),
      id = randomUUID(),
      outside = join(f.root, "outside");
    const from = join(f.home, cache ? "cache" : "recordings"),
      save = join(f.home, "saved");
    const inside = cache
      ? join(from, "derived", `${id}.cache`)
      : join(from, id, "source", "video.mov");
    const external = cache
      ? join(outside, "derived", `${id}.cache`)
      : join(outside, id, "source", "video.mov");
    await mkdir(resolve(inside, ".."), { recursive: true, mode: 0o700 });
    await mkdir(resolve(external, ".."), { recursive: true, mode: 0o700 });
    await writeFile(inside, "owned");
    await writeFile(external, "external-sentinel");
    const dylib = join(f.root, "swap.dylib");
    const compiled = spawnSync(
      "clang",
      [
        "-dynamiclib",
        "-o",
        dylib,
        resolve(import.meta.dirname, "fixtures/managed-files-interpose.c"),
      ],
      { encoding: "utf8" },
    );
    assert.equal(compiled.status, 0, compiled.stderr);
    const operation = cache ? "storage.removeCacheFiles" : "storage.removeRecordingDirectory";
    const params = cache
      ? {
          home: f.home,
          expectedHome: f.expectedHome,
          expectedCacheRoot: f.expectedCacheRoot,
          ids: [id],
        }
      : { home: f.home, expectedHome: f.expectedHome, recordingId: id };
    const fd = recordingDescriptor(operation, params);
    const run = spawnSync(native, [], {
      stdio: ["pipe", "pipe", "pipe", ...(fd === undefined ? [] : [fd])],
      input: JSON.stringify({ id: "race", operation, params }) + "\n",
      encoding: "utf8",
      timeout: 30000,
      env: {
        ...process.env,
        DYLD_INSERT_LIBRARIES: dylib,
        YAP_SWAP_NAME: cache ? "derived" : id,
        YAP_SWAP_FROM: from,
        YAP_SWAP_SAVE: save,
        YAP_SWAP_EXTERNAL: outside,
      },
    });
    if (fd !== undefined) closeSync(fd);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stderr, /managed-swap-complete/);
    assert.deepEqual(JSON.parse(run.stdout).data, { removed: true });
    assert.equal(await readFile(external, "utf8"), "external-sentinel");
    await assert.rejects(lstat(cache ? join(save, "derived", `${id}.cache`) : join(save, id)), {
      code: "ENOENT",
    });
  });

test(
  "large inventories are streamed and excessive nesting fails without leaking directory descriptors",
  { timeout: 30000 },
  async (t) => {
    const f = await fixture(t),
      wide = randomUUID(),
      deep = randomUUID();
    const wideRoot = join(f.home, "recordings", wide);
    await mkdir(wideRoot, { recursive: true, mode: 0o700 });
    for (let batch = 0; batch < 32; batch++)
      await Promise.all(
        Array.from({ length: 64 }, (_, i) =>
          writeFile(join(wideRoot, `leaf-${batch * 64 + i}`), "scratch"),
        ),
      );
    assert.deepEqual(
      call("storage.removeRecordingDirectory", {
        home: f.home,
        expectedHome: f.expectedHome,
        recordingId: wide,
      }).data,
      { removed: true },
    );
    await assert.rejects(lstat(wideRoot), { code: "ENOENT" });
    let nested = join(f.home, "recordings", deep);
    for (let depth = 0; depth <= 64; depth++) {
      await mkdir(nested, { recursive: true, mode: 0o700 });
      nested = join(nested, "nested");
    }
    const fd = recordingDescriptor("storage.removeRecordingDirectory", {
      home: f.home,
      recordingId: deep,
    });
    t.after(() => closeSync(fd));
    const child = spawn(native, [], { stdio: ["pipe", "pipe", "pipe", fd] });
    const lines = createInterface({ input: child.stdout });
    const responses = lines[Symbol.asyncIterator]();
    let stderr = "";
    child.stderr.on("data", (chunk) => (stderr += chunk));
    t.after(async () => {
      lines.close();
      if (child.exitCode === null && child.signalCode === null) {
        const stopped = once(child, "close");
        child.kill("SIGKILL");
        await stopped;
      }
    });
    async function request(operation, params) {
      child.stdin.write(JSON.stringify({ id: "fd-test", operation, params }) + "\n");
      const result = await responses.next();
      assert.equal(result.done, false, stderr);
      return JSON.parse(result.value);
    }
    const params = { home: f.home, expectedHome: f.expectedHome, recordingId: deep };
    assert.equal(
      (await request("storage.removeRecordingDirectory", params)).error.code,
      "LIMIT_EXCEEDED",
    );
    function descriptors() {
      const p = spawnSync("/usr/sbin/lsof", ["-a", "-p", String(child.pid), "-Ff"], {
        encoding: "utf8",
      });
      assert.equal(p.status, 0, p.stderr);
      return p.stdout
        .split("\n")
        .filter((line) => /^f\d+$/.test(line))
        .sort();
    }
    const before = descriptors();
    assert.ok(before.length >= 3);
    for (let i = 0; i < 40; i++) {
      assert.equal(
        (await request("storage.removeRecordingDirectory", params)).error.code,
        "LIMIT_EXCEEDED",
      );
      assert.equal(
        (
          await request("storage.removeRecordingDirectory", {
            ...params,
            expectedHome: { ...f.expectedHome, ino: "18446744073709551615" },
          })
        ).error.code,
        "INVALID_STORAGE",
      );
      assert.deepEqual(
        (await request("storage.removeRecordingDirectory", { ...params, recordingId: wide })).data,
        { removed: true },
      );
    }
    assert.deepEqual(descriptors(), before);
    const closed = once(child, "close");
    child.stdin.end();
    assert.equal((await closed)[0], 0, stderr);
  },
);

test("native directory identity comparisons preserve inode bits above JavaScript integer precision", async (t) => {
  const f = await fixture(t),
    recordingId = randomUUID(),
    dylib = join(f.root, "identity.dylib");
  const compile = spawnSync(
    "clang",
    [
      "-dynamiclib",
      "-o",
      dylib,
      resolve(import.meta.dirname, "fixtures/managed-files-interpose.c"),
    ],
    { encoding: "utf8" },
  );
  assert.equal(compile.status, 0, compile.stderr);
  const request = (ino) => {
    const params = { home: f.home, expectedHome: { ...f.expectedHome, ino }, recordingId };
    const run = spawnSync(native, [], {
      input:
        JSON.stringify({ id: "identity", operation: "storage.removeRecordingDirectory", params }) +
        "\n",
      encoding: "utf8",
      timeout: 30000,
      env: {
        ...process.env,
        DYLD_INSERT_LIBRARIES: dylib,
        YAP_ACTUAL_HOME_INO: f.expectedHome.ino,
        YAP_REPORTED_HOME_INO: "9007199254740993",
      },
    });
    assert.equal(run.status, 0, run.stderr);
    return JSON.parse(run.stdout);
  };
  assert.deepEqual(request("9007199254740993").data, { removed: true });
  assert.equal(request("9007199254740992").error.code, "INVALID_STORAGE");
});

test("a replaced named recording refuses the stale descriptor and preserves both directories", async (t) => {
  const f = await fixture(t),
    recordingId = randomUUID();
  const target = join(f.home, "recordings", recordingId),
    moved = join(f.home, "moved");
  await mkdir(target, { recursive: true, mode: 0o700 });
  await writeFile(join(target, "original"), "original donor");
  const params = { home: f.home, expectedHome: f.expectedHome, recordingId };
  const fd = recordingDescriptor("storage.removeRecordingDirectory", params);
  try {
    assert.equal(call("storage.recordingDirectory", params, [fd]).ok, true);
    await rename(target, moved);
    await mkdir(target, { mode: 0o700 });
    await writeFile(join(target, "replacement"), "replacement directory");
    assert.equal(
      call("storage.removeRecordingDirectory", params, [fd]).error.code,
      "INVALID_STORAGE",
    );
    assert.equal(await readFile(join(moved, "original"), "utf8"), "original donor");
    assert.equal(await readFile(join(target, "replacement"), "utf8"), "replacement directory");
    assert.equal(
      call("storage.removeRecordingDirectory", params, []).error.code,
      "INVALID_STORAGE",
    );
    assert.equal(await readFile(join(target, "replacement"), "utf8"), "replacement directory");
  } finally {
    closeSync(fd);
  }
  assert.deepEqual(call("storage.removeRecordingDirectory", params).data, { removed: true });
  assert.deepEqual(call("storage.removeRecordingDirectory", params, []).data, { removed: true });
  assert.equal(await readFile(join(moved, "original"), "utf8"), "original donor");
});
