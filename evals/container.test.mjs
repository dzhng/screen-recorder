import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

test("a Docker transport failure cannot pass with a printed successful artifact", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "eval-docker-peer-"));
  try {
    await writeFile(
      join(scratch, "docker"),
      `#!${process.execPath}\nif(process.argv[2]==='run'){process.stdin.resume();process.stdin.on('end',()=>{console.log(JSON.stringify({response:'Ready',exit:0}));process.exitCode=7})}\n`,
      { mode: 0o755 },
    );
    const module = new URL("./container.mjs", import.meta.url).href;
    const script = `import {runContainer} from ${JSON.stringify(module)};console.log(JSON.stringify(await runContainer({image:'fixture',request:{}})));`;
    const result = JSON.parse(
      execFileSync(process.execPath, ["--input-type=module", "-e", script], {
        encoding: "utf8",
        env: { ...process.env, PATH: `${scratch}:${process.env.PATH}` },
      }),
    );
    assert.match(result.error, /exited 7/);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test("a timed-out run forcibly removes its disposable container", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "eval-docker-peer-"));
  const active = join(scratch, "container-active");
  try {
    await writeFile(
      join(scratch, "docker"),
      `#!${process.execPath}\nconst fs=require('node:fs');const active=${JSON.stringify(active)};if(process.argv[2]==='run'){fs.writeFileSync(active,'active');process.stdin.resume();process.on('SIGTERM',()=>{});setInterval(()=>{},1000)}else if(process.argv[2]==='rm'){fs.rmSync(active,{force:true})}\n`,
      { mode: 0o755 },
    );
    const module = new URL("./container.mjs", import.meta.url).href;
    const script = `import {runContainer} from ${JSON.stringify(module)};console.log(JSON.stringify(await runContainer({image:'fixture',request:{},timeoutMs:250})));`;
    const result = JSON.parse(
      execFileSync(process.execPath, ["--input-type=module", "-e", script], {
        encoding: "utf8",
        timeout: 5000,
        env: { ...process.env, PATH: `${scratch}:${process.env.PATH}` },
      }),
    );
    assert.match(result.error, /timed out/);
    await assert.rejects(access(active), { code: "ENOENT" });
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
