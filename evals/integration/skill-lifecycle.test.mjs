import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, cp, rm, chmod } from "node:fs/promises";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { projectSnapshot } from "../runtime/skills.mjs";

test("documented real installer steps preserve inspection and restore failed replacement", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "skill-production-"));
  const source = join(scratch, "source"),
    project = join(scratch, "project"),
    home = join(scratch, "home");
  const guide = await readFile(
    new URL("../../skills/screenrec/references/skill-lifecycle.md", import.meta.url),
    "utf8",
  );
  const allBlocks = [...guide.matchAll(/```sh\n([\s\S]*?)```/g)].map((match) => match[1]);
  const blocks = [
    allBlocks[0],
    allBlocks.find((block) => block.startsWith("test ! -e")),
    allBlocks.find((block) => block.startsWith("diff -ru")),
    allBlocks.find((block) => block.includes("screenrec_backup=$(mktemp -d)")),
  ];
  const receipt = {
    sourceRevision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    commands: [],
  };
  async function call(index, candidate = source) {
    const result = spawnSync("sh", ["-c", blocks[index]], {
      cwd: project,
      env: {
        ...process.env,
        HOME: home,
        TMPDIR: join(project, "backups"),
        screenrec_source: candidate,
        DISABLE_TELEMETRY: "1",
        NODE_DISABLE_COMPILE_CACHE: "1",
      },
      encoding: "utf8",
    });
    receipt.commands.push({
      block: index,
      exit: result.status,
      stdout: result.stdout.replaceAll(scratch, "<scratch>"),
      stderr: result.stderr.replaceAll(scratch, "<scratch>"),
    });
    return result.status;
  }
  try {
    if (process.env.SCREENREC_SKILL_BASELINE) {
      await mkdir(source);
      const archive = execFileSync("git", [
        "archive",
        process.env.SCREENREC_SKILL_BASELINE,
        "skills/screenrec",
      ]);
      const extraction = join(scratch, "extraction");
      await mkdir(extraction);
      execFileSync("tar", ["-xf", "-", "-C", extraction], { input: archive });
      await cp(join(extraction, "skills/screenrec"), source, { recursive: true });
      receipt.matchedBaseline = process.env.SCREENREC_SKILL_BASELINE;
    } else
      await cp(new URL("../../skills/screenrec/", import.meta.url), source, { recursive: true });
    await mkdir(project);
    await mkdir(home);
    await mkdir(join(project, "backups"));
    await mkdir(join(project, ".claude"));
    await writeFile(join(project, ".claude/settings.json"), '{"unrelated":true}\n');
    receipt.source = await projectSnapshot(source, 500);
    assert.equal(await call(1), 0);
    receipt.installed = await projectSnapshot(project, 500);
    assert.equal(
      receipt.installed[".claude/skills/screenrec"].target,
      "../../.agents/skills/screenrec",
    );
    await writeFile(join(project, ".agents/skills/screenrec/SKILL.md"), "LOCAL CUSTOMIZATION\n");
    await writeFile(join(project, ".agents/skills/screenrec/local-notes.md"), "Local extra\n");
    await writeFile(
      join(project, ".agents/skills/screenrec/references/removed.md"),
      "Upstream deleted\n",
    );
    await writeFile(join(source, "references/added.md"), "Upstream addition\n");
    receipt.customized = await projectSnapshot(project, 500);
    assert.equal(await call(2), 1);
    assert.deepEqual(await projectSnapshot(project, 500), receipt.customized);
    assert.match(receipt.commands.at(-1).stdout, /local-notes\.md/);
    assert.match(receipt.commands.at(-1).stdout, /removed\.md/);
    assert.match(receipt.commands.at(-1).stdout, /added\.md/);
    const invalid = join(scratch, "invalid");
    await mkdir(invalid);
    assert.notEqual(await call(3, invalid), 0);
    receipt.failedRestored = await projectSnapshot(project, 500);
    for (const [path, entry] of Object.entries(receipt.customized))
      assert.deepEqual(receipt.failedRestored[path], entry, path);
    assert.equal(await call(3), 0);
    receipt.replaced = await projectSnapshot(project, 500);
    assert.ok(!receipt.replaced[".agents/skills/screenrec/local-notes.md"]);
    assert.ok(!receipt.replaced[".agents/skills/screenrec/references/removed.md"]);
    assert.equal(
      receipt.replaced[".agents/skills/screenrec/references/added.md"].text,
      "Upstream addition\n",
    );
    assert.deepEqual(
      receipt.replaced[".claude/settings.json"],
      receipt.customized[".claude/settings.json"],
    );
    const blocked = join(project, ".agents/skills/screenrec/blocked");
    await mkdir(blocked);
    await writeFile(
      join(blocked, "retained.txt"),
      "Cannot remove without directory write access\n",
    );
    await chmod(blocked, 0o500);
    try {
      assert.notEqual(await call(3), 0);
      assert.match(receipt.commands.at(-1).stderr, /Cleanup failed; backup retained at/);
      assert.doesNotMatch(
        receipt.commands.at(-1).stdout,
        /prior entries restored|Replaced; backup/,
      );
    } finally {
      await chmod(blocked, 0o700);
    }
    receipt.verdict =
      "Documented installer/diff/replacement/failed-add restore executed against complete controlled local folders.";
    if (process.env.SCREENREC_SKILL_PROOF_OUTPUT)
      await writeFile(
        process.env.SCREENREC_SKILL_PROOF_OUTPUT,
        JSON.stringify(receipt, null, 2) + "\n",
      );
  } finally {
    execFileSync("chmod", ["-R", "u+w", scratch]);
    await rm(scratch, { recursive: true, force: true });
  }
});
