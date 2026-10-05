import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  chmodSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const assemble = fileURLToPath(
  new URL("../../packages/test-harness/editing/optional-runtime-assemble.py", import.meta.url),
);
const launcher = fileURLToPath(new URL("./launch.py", import.meta.url));
test("one clone-only artifact preserves primary precedence and supplemental namespaces after relocation", () => {
  const scratch = mkdtempSync(join(tmpdir(), "optional-runtime-"));
  try {
    const source = join(scratch, "sources");
    const base = join(source, "base");
    const primary = join(source, "primary");
    const layers = [join(source, "supplemental1"), join(source, "supplemental2")];
    for (const path of [
      join(base, "bin"),
      join(base, "lib/python3.12/site-packages"),
      primary,
      ...layers,
    ])
      mkdirSync(path, { recursive: true });
    writeFileSync(join(base, "bin/python3.12"), "a pinned test interpreter", { mode: 0o700 });
    writeFileSync(join(base, "lib/python3.12/stdlib.py"), "# pinned stdlib bytes\n");
    mkdirSync(join(base, "lib/pkgconfig"));
    writeFileSync(join(base, "lib/pkgconfig/python-3.12.pc"), "developer link metadata\n");
    symlinkSync("/outside/download-scratch/python-3.12.pc", join(base, "lib/pkgconfig/python3.pc"));
    writeFileSync(join(primary, "chosen.py"), 'value="primary"\n');
    writeFileSync(join(layers[0], "chosen.py"), 'value="supplemental"\n');
    mkdirSync(join(primary, "vendor"));
    writeFileSync(join(primary, "vendor.pth"), "vendor\n");
    writeFileSync(join(primary, "vendor/vendored.py"), 'value="primary-path"\n');
    writeFileSync(join(layers[0], "vendored.py"), 'value="supplemental-path"\n');
    for (const [index, layer] of layers.entries()) {
      mkdirSync(join(layer, "namespace"));
      writeFileSync(join(layer, "namespace", `item${index}.py`), `value=${index}\n`);
    }
    writeFileSync(join(primary, "cache-paths.pth"), layers.join("\n") + "\n");
    mkdirSync(join(primary, "assets"));
    chmodSync(join(primary, "assets"), 0o775);
    writeFileSync(join(primary, "assets/model.pth"), "model bytes are not a path file");
    const worker = join(source, "worker.py");
    writeFileSync(
      worker,
      'import json,chosen,vendored,namespace.item0,namespace.item1\nprint(json.dumps({"chosen":chosen.value,"vendored":vendored.value,"namespace":[namespace.item0.value,namespace.item1.value]}))\n',
    );
    const out = join(scratch, "out");
    const command = [
      "-I",
      "-B",
      assemble,
      "--base",
      base,
      "--primary",
      primary,
      "--worker",
      worker,
      "--launcher",
      launcher,
      "--out",
      out,
      "--omit-path-file",
      "cache-paths.pth",
      ...layers.flatMap((path) => ["--supplemental", path]),
    ];
    const built = spawnSync("/usr/bin/python3", command, { encoding: "utf8", timeout: 5000 });
    assert.equal(built.status, 0, built.stderr);
    const report = JSON.parse(readFileSync(join(out, "assembly.json")));
    assert.equal(report.passed, true);
    assert.equal(
      report.copyMethod,
      "clonefile only; distinct source/destination inodes checked; no fallback",
    );
    const manifest = JSON.parse(readFileSync(join(out, "manifest.json")));
    assert(
      !manifest.some((e) => e.path.includes("/pkgconfig/")),
      "development pkg-config metadata is outside execution closure",
    );
    assert(!manifest.some((e) => e.path.endsWith("cache-paths.pth")));
    assert(manifest.some((e) => e.path.endsWith("/assets/model.pth")));
    assert.equal(
      manifest.find((e) => e.path.endsWith("/assets")).mode,
      0o775,
      "original directory access mode survives assembly",
    );
    assert.equal(
      readFileSync(join(out, "bundle/python/lib/python3.12/site-packages/chosen.py"), "utf8"),
      'value="primary"\n',
    );
    // Pure import/bootstrap control uses the host stdlib; this is not interpreter/model relocation proof.
    const target = join(scratch, "relocated");
    const moved = spawnSync("/bin/mv", [join(out, "bundle"), target], { encoding: "utf8" });
    assert.equal(moved.status, 0, moved.stderr);
    const code = `import site,runpy;site.addsitedir(${JSON.stringify(join(target, "python/lib/python3.12/site-packages"))});runpy.run_path(${JSON.stringify(join(target, "execution/launch.py"))},run_name='__main__')`;
    const probe = spawnSync("/usr/bin/python3", ["-I", "-B", "-c", code], {
      encoding: "utf8",
      timeout: 3000,
    });
    assert.equal(probe.status, 0, probe.stderr);
    assert.deepEqual(JSON.parse(probe.stdout), {
      chosen: "primary",
      vendored: "primary-path",
      namespace: [0, 1],
    });
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
test("assembly refuses an undeclared absolute primary import path before cloning", () => {
  const scratch = mkdtempSync(join(tmpdir(), "optional-runtime-path-"));
  try {
    const source = join(scratch, "sources");
    const base = join(source, "base");
    const primary = join(source, "primary");
    mkdirSync(join(base, "bin"), { recursive: true });
    mkdirSync(join(base, "lib/python3.12/site-packages"), { recursive: true });
    mkdirSync(primary);
    writeFileSync(join(base, "bin/python3.12"), "test interpreter");
    writeFileSync(join(primary, "donor.pth"), "/outside/prepared/artifact\n");
    const worker = join(source, "worker.py");
    writeFileSync(worker, 'print("unused")\n');
    const out = join(scratch, "out");
    const built = spawnSync(
      "/usr/bin/python3",
      [
        "-I",
        "-B",
        assemble,
        "--base",
        base,
        "--primary",
        primary,
        "--worker",
        worker,
        "--launcher",
        launcher,
        "--out",
        out,
      ],
      { encoding: "utf8", timeout: 5000 },
    );
    assert.notEqual(built.status, 0);
    assert.match(built.stderr, /Undeclared primary import path/);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
