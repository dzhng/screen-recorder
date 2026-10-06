import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

// The barrier pauses actual Node after CLI load, before a later resource read.
// A replacement attempt must be rejected while that lifetime still owns A.
test("a live bundled CLI prevents replacement through its later resource read", () => {
  const result = spawnSync(process.execPath, ["scripts/launcher-lab.mjs"], {
    encoding: "utf8",
    timeout: 30000,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.legacy.loaded, "A");
  assert.equal(report.legacy.resource, "B");
  assert.equal(report.protected.swapStatus, 75);
  assert.equal(report.protected.loaded, "A");
  assert.equal(report.protected.resource, "A");
  assert.equal(report.afterExit.swapStatus, 0);
  assert.equal(report.afterExit.loaded, "B");
  assert.equal(report.afterExit.resource, "B");
});

test("help enters under exclusion and an initialized idle MCP session retains it", () => {
  const result = spawnSync(process.execPath, ["scripts/launcher-lab.mjs", "--actual-cli"], {
    encoding: "utf8",
    timeout: 30000,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.actualHelp.swapStatus, 75);
  assert.ok(report.actualHelp.operations.includes("service.health"));
  assert.equal(report.actualMcp.swapStatus, 75);
  assert.ok(report.actualMcp.tools.includes("service.health"));
  assert.equal(report.actualMcp.afterCrashStatus, 0);
  assert.equal(report.exclusiveOwner.launchStatus, 75);
  assert.equal(report.exclusiveOwner.afterCrashStatus, 0);
});

test("termination cleans a stalled child and its scratch bundle", async () => {
  const { spawn } = await import("node:child_process");
  const { existsSync } = await import("node:fs");
  const runner = spawn(process.execPath, ["scripts/launcher-lab.mjs", "--hold"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const closed = new Promise((resolve) => runner.once("close", resolve));
  let trace = "";
  const barrier = await new Promise((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error("barrier not reached")), 10000);
    runner.stderr.on("data", (bytes) => {
      trace += bytes.toString();
      for (const line of trace.split("\n")) {
        try {
          const event = JSON.parse(line);
          if (event.barrier === "legacy-read") {
            clearTimeout(deadline);
            resolve(event);
          }
        } catch {}
      }
    });
  });
  try {
    runner.kill("SIGTERM");
    await closed;
    assert.throws(() => process.kill(barrier.pid, 0), { code: "ESRCH" });
    assert.equal(existsSync(barrier.scratch), false);
  } finally {
    try {
      process.kill(barrier.pid, "SIGKILL");
    } catch {}
    const { rmSync } = await import("node:fs");
    rmSync(barrier.scratch, { recursive: true, force: true });
  }
});

test("compiler stalls and MCP errors follow owned teardown", async () => {
  const { spawn } = await import("node:child_process");
  const { existsSync, mkdtempSync, writeFileSync, readFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { setTimeout: delay } = await import("node:timers/promises");
  for (const mode of ["compiler", "mcp"]) {
    const fixture = mkdtempSync(join(tmpdir(), "yap-launcher-failure-"));
    const marker = join(fixture, "child.json");
    const cli = `import fs from 'node:fs';
if(process.argv.includes('--help')) console.log(JSON.stringify({operations:[{name:'service.health'}]}));
else {
fs.writeFileSync(${JSON.stringify(marker)},JSON.stringify({pid:process.pid,scratch:process.env.YAP_APP.split('/Relocated with spaces/')[0]}));
let input=''; process.stdin.on('data',bytes=> {input+=bytes; if(input.includes('"id":2')) console.log(JSON.stringify({jsonrpc:'2.0',id:2,error:{code:-32603,message:'controlled failure'}}));});
setInterval(()=>{},1000);
}`;
    const shim =
      mode === "compiler"
        ? `const fs=require('node:fs');const path=require('node:path');
fs.writeFileSync(${JSON.stringify(marker)},JSON.stringify({pid:process.pid,scratch:path.dirname(process.argv.at(-1))}));
process.on('SIGTERM',()=>{});setInterval(()=>{},1000);`
        : `require('node:fs').writeFileSync(process.argv.at(-1),${JSON.stringify(cli)});`;
    writeFileSync(
      join(fixture, mode === "compiler" ? "clang" : "bun"),
      `#!${process.execPath}\n${shim}\n`,
      { mode: 0o755 },
    );
    const runner = spawn(
      process.execPath,
      ["scripts/launcher-lab.mjs", ...(mode === "mcp" ? ["--actual-cli"] : [])],
      {
        env: { ...process.env, PATH: fixture + ":" + process.env.PATH },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const closed = new Promise((resolve) => runner.once("close", resolve));
    let child;
    try {
      for (let i = 0; i < 1000 && !existsSync(marker); i++) await delay(10);
      child = JSON.parse(readFileSync(marker, "utf8"));
      if (mode === "compiler") runner.kill("SIGTERM");
      assert.equal(
        await Promise.race([
          closed,
          delay(3000, undefined, { ref: false }).then(() => {
            throw new Error("Runner did not finish owned teardown");
          }),
        ]),
        mode === "compiler" ? 143 : 1,
      );
      assert.throws(() => process.kill(child.pid, 0), { code: "ESRCH" });
      assert.equal(existsSync(child.scratch), false);
    } finally {
      runner.kill("SIGKILL");
      await closed;
      if (child) {
        try {
          process.kill(child.pid, "SIGKILL");
        } catch {}
        rmSync(child.scratch, { recursive: true, force: true });
      }
      rmSync(fixture, { recursive: true, force: true });
    }
  }
});
