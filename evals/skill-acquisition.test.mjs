import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

test("documented Git-free acquisition pins every recursive fetch and rejects unavailable/incomplete input", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "skill-api-"));
  try {
    const guide = await readFile(
      new URL("../skills/screenrec/references/skill-lifecycle.md", import.meta.url),
      "utf8",
    );
    const script = guide.match(
      /node --input-type=module <<'NODE' \|\| exit 1\n([\s\S]*?)\nNODE/,
    )[1];
    const sha = "a".repeat(40);
    const preload = join(scratch, "network.mjs");
    await writeFile(
      preload,
      `
      const sha = ${JSON.stringify(sha)};
      globalThis.fetch = async (url) => {
        if (process.env.FIXTURE_UNAVAILABLE) return new Response('unavailable', {status:503});
        if (url.endsWith('/commits/main')) return Response.json({sha});
        if (url.endsWith('/contents/skills/screenrec?ref='+sha)) return Response.json([
          {type:'file',name:'SKILL.md',path:'skills/screenrec/SKILL.md'},
          {type:process.env.FIXTURE_INCOMPLETE?'symlink':'dir',name:'references',path:'skills/screenrec/references'}
        ]);
        if (url.endsWith('/contents/skills/screenrec/references?ref='+sha)) return Response.json([{type:'file',name:'installation.md',path:'skills/screenrec/references/installation.md'}]);
        if (url.endsWith('/'+sha+'/skills/screenrec/SKILL.md')) return new Response('complete skill');
        if (url.endsWith('/'+sha+'/skills/screenrec/references/installation.md')) return new Response('complete reference');
        throw new Error('Unpinned or unexpected fetch: '+url);
      };
    `,
    );
    const execute = (extra = {}) =>
      spawnSync(process.execPath, ["--import", preload, "--input-type=module", "-"], {
        input: script,
        env: { ...process.env, SCREENREC_SKILL_STAGE: scratch, ...extra },
        encoding: "utf8",
      });
    const success = execute();
    assert.equal(success.status, 0, success.stderr);
    assert.equal(await readFile(join(scratch, "source-commit.txt"), "utf8"), sha + "\n");
    assert.equal(
      await readFile(join(scratch, "screenrec/references/installation.md"), "utf8"),
      "complete reference",
    );
    const unavailable = execute({ FIXTURE_UNAVAILABLE: "1" });
    assert.notEqual(unavailable.status, 0);
    assert.match(unavailable.stderr, /HTTP 503/);
    const incomplete = execute({ FIXTURE_INCOMPLETE: "1" });
    assert.notEqual(incomplete.status, 0);
    assert.match(incomplete.stderr, /Unsupported source entry/);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
