import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

test("contracts-only completes without invoking an agent or loading credentials", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "eval-controls-"));
  try {
    await writeFile(join(scratch, "cli.mjs"), "fixture bundle");
    await writeFile(
      join(scratch, "docker"),
      `#!${process.execPath}\nconst fs=require('node:fs');const args=process.argv.slice(2);if(args[0]==='build'){fs.writeFileSync(args[args.indexOf('--iidfile')+1],'fixture-image')}else if(args[0]==='run'){process.stdin.resume();process.stdin.on('end',()=>console.log(JSON.stringify({passed:6})))}\n`,
      { mode: 0o755 },
    );
    const output = join(scratch, "reports");
    const stdout = execFileSync(
      process.execPath,
      [
        new URL("./run.mjs", import.meta.url).pathname,
        "--contracts-only",
        "--cli",
        join(scratch, "cli.mjs"),
        "--output",
        output,
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${scratch}:${process.env.PATH}`,
          CODEX_HOME: join(scratch, "no-auth"),
        },
      },
    );
    assert.doesNotMatch(stdout, /Running .*-(codex|claude)-/);
    const summary = JSON.parse(await readFile(join(output, "summary.json"), "utf8"));
    assert.equal(summary.plannedTrials, 0);
    assert.equal(summary.error, undefined);
    assert.ok(summary.completedAt);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test("README trials expose the linked consumer folder without preinstalling a skill", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "eval-readme-"));
  try {
    const log = join(scratch, "inputs.jsonl");
    await writeFile(join(scratch, "cli.mjs"), "fixture bundle");
    await writeFile(
      join(scratch, "auth.json"),
      JSON.stringify({ auth_mode: "apikey", OPENAI_API_KEY: "eval-fixture-only-key" }),
    );
    await writeFile(
      join(scratch, "docker"),
      `#!${process.execPath}\nconst fs=require('node:fs');const cp=require('node:child_process');const args=process.argv.slice(2);if(args[0]==='build'){fs.writeFileSync(args[args.indexOf('--iidfile')+1],'fixture-image')}else if(args[0]==='run'){let data=[];process.stdin.on('data',b=>data.push(b));process.stdin.on('end',()=>{const paths=cp.execFileSync('tar',['-tf','-'],{input:Buffer.concat(data),encoding:'utf8'}).trim().split('\\n');fs.appendFileSync(${JSON.stringify(log)},JSON.stringify(paths)+'\\n');console.log(JSON.stringify({passed:6,response:JSON.stringify({pass:true,evidence:['Fixture response']})}))})}\n`,
      { mode: 0o755 },
    );
    execFileSync(
      process.execPath,
      [
        new URL("./run.mjs", import.meta.url).pathname,
        "--agents",
        "codex",
        "--cases",
        "readme",
        "--repeats",
        "1",
        "--cli",
        join(scratch, "cli.mjs"),
        "--output",
        join(scratch, "reports"),
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          OPENAI_API_KEY: "",
          PATH: `${scratch}:${process.env.PATH}`,
          CODEX_HOME: scratch,
        },
      },
    );
    const inputs = (await readFile(log, "utf8")).trim().split("\n").map(JSON.parse);
    const runner = inputs.find((paths) => paths.includes("work/README.md"));
    assert.ok(runner.includes("work/skills/screenrec/SKILL.md"));
    assert.ok(runner.includes("work/skills/screenrec/references/installation.md"));
    assert.ok(
      !runner.some(
        (path) => path.startsWith("work/.agents/skills/") || path.endsWith("cases.json"),
      ),
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
