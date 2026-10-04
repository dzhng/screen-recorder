// Run from the repository root: node specs/auto-update/assets/reproduce-skills.mjs
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { projectSnapshot } from "../../../evals/runtime/skills.mjs";

const baseline = "fff09bfcc1fb540ea026f0a85f916a50ed717304";
const scratch = await mkdtemp(join(tmpdir(), "screenrec-skill-proof-"));
const source = join(scratch, "source"), project = join(scratch, "project");
const receipt = { baseline, consumerTree: execFileSync("git", ["rev-parse", `${baseline}:skills/screenrec`], { encoding: "utf8" }).trim(), skillsVersion: "1.7.0", platform: process.platform, architecture: process.arch, commands: [] };
try {
  await mkdir(source); await mkdir(project); await mkdir(join(scratch, "home"));
  execFileSync("tar", ["-xf", "-", "-C", source], { input: execFileSync("git", ["archive", baseline, "skills/screenrec"]) });
  await mkdir(join(project, ".claude"));
  await writeFile(join(project, ".claude/settings.json"), '{"unrelated":true}\n');
  receipt.source = await projectSnapshot(source);
  receipt.before = await projectSnapshot(project);
  const args = ["--yes", "skills@1.7.0", "add", join(source, "skills/screenrec"), "--skill", "screenrec", "--agent", "codex", "claude-code", "--yes"];
  function install() {
    const stdout = execFileSync("npx", args, { cwd: project, env: { ...process.env, HOME: join(scratch, "home"), DISABLE_TELEMETRY: "1" }, encoding: "utf8" });
    receipt.commands.push({ command: ["npx", ...args].map((value) => value.replaceAll(scratch, "<scratch>")), exit: 0, stdout: stdout.replaceAll(scratch, "<scratch>") });
  }
  install(); receipt.installed = await projectSnapshot(project);
  assert.equal(receipt.installed[".claude/skills/screenrec"].target, "../../.agents/skills/screenrec");
  assert.deepEqual(receipt.before[".claude/settings.json"], receipt.installed[".claude/settings.json"]);
  await writeFile(join(project, ".agents/skills/screenrec/SKILL.md"), "edited locally\n");
  receipt.customized = await projectSnapshot(project);
  install(); receipt.reinstalled = await projectSnapshot(project);
  assert.equal(await readFile(join(project, ".agents/skills/screenrec/SKILL.md"), "utf8"), await readFile(join(source, "skills/screenrec/SKILL.md"), "utf8"));
  receipt.verdict = "Prior limited claims reproduced; this is not production-step or model parity.";
  await writeFile("specs/auto-update/assets/skills-reproduction.json", JSON.stringify(receipt, null, 2) + "\n");
} finally { await rm(scratch, { recursive: true, force: true }); }
