import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { expect, test } from "vitest";
import { runtimeMaterializer } from "./runtime-materialization.js";

test("runtime preparation retains resource and implied archive directory modes under a restrictive mask", async () => {
  const home = await mkdtemp("/tmp/yap-runtime-materialization-");
  const previous = process.umask(0o077);
  try {
    // Assembly responses are controlled; resource staging and archive extraction stay real.
    await mkdir(join(home, "donor/python/lib/implied"), { recursive: true });
    await writeFile(join(home, "donor/python/lib/implied/value"), "archive input");
    execFileSync("/usr/bin/tar", [
      "-czf",
      join(home, "interpreter.tar.gz"),
      "-C",
      join(home, "donor"),
      "python/lib/implied/value",
    ]);
    const owner = join(home, "owner");
    await writeFile(
      owner,
      `#!${process.execPath}
process.on('exit', code => require('node:fs').writeSync(Number(process.argv[3]), String(code)+'\\n'));
if(process.argv[6] !== '/usr/bin/sandbox-exec') {
  const result = require('node:child_process').spawnSync(process.argv[6], process.argv.slice(7));
  process.stdout.write(result.stdout); process.stderr.write(result.stderr); process.exitCode = result.status;
} else process.stdout.write('{"ready":true}');
`,
    );
    await chmod(owner, 0o755);
    const content = "pinned execution resource";
    await runtimeMaterializer(owner)!({
      inputs: home,
      directory: join(home, "output"),
      signal: new AbortController().signal,
      acquisition: {
        recipe: "python-wheels-v1",
        files: [],
        interpreterArchive: "interpreter.tar.gz",
        installs: [],
        nativePolicy: { files: [] },
        resources: [
          {
            path: "worker.py",
            content,
            sha256: createHash("sha256").update(content).digest("hex"),
          },
        ],
      },
    });
    expect((await stat(join(home, "scripts/worker.py"))).mode & 0o777).toBe(0o644);
    expect((await stat(join(home, "interpreter/lib/implied"))).mode & 0o777).toBe(0o755);
  } finally {
    process.umask(previous);
    await rm(home, { recursive: true, force: true });
  }
});
