import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { projectSnapshot, skillCaseFiles } from "./runtime/skills.mjs";

test("skill fixtures expose complete upstream and preserve customized installed inputs", async () => {
  const skill = { "SKILL.md": "skill", "references/install.md": "guide" };
  const files = skillCaseFiles(skill, "skill-diff");
  assert.equal(files["work/upstream/skills/screenrec/references/install.md"], "guide");
  assert.match(files["work/.agents/skills/screenrec/SKILL.md"], /LOCAL CUSTOMIZATION/);
  assert.ok(files["work/.agents/skills/screenrec/local-notes.md"]);
  assert.ok(files["work/.agents/skills/screenrec/references/removed.md"]);
  assert.ok(files["work/upstream/skills/screenrec/references/added.md"]);
  assert.equal(skillCaseFiles(skill, "skill-install")["work/.agents/skills/screenrec/SKILL.md"], undefined);
  assert.ok(!Object.keys(files).some((path) => path.endsWith("cases.json")));
});

test("project receipts inspect actual bytes and links without following discovery symlinks", async () => {
  const root = await mkdtemp(join(tmpdir(), "skill-receipts-"));
  try {
    await mkdir(join(root, ".agents/skills/screenrec"), { recursive: true });
    await mkdir(join(root, ".claude/skills"), { recursive: true });
    await writeFile(join(root, ".agents/skills/screenrec/SKILL.md"), "custom");
    await writeFile(join(root, ".claude/settings.json"), "unrelated");
    await symlink("../../.agents/skills/screenrec", join(root, ".claude/skills/screenrec"));
    const before = await projectSnapshot(root);
    assert.equal(before[".agents/skills/screenrec/SKILL.md"].text, "custom");
    assert.equal(before[".claude/skills/screenrec"].target, "../../.agents/skills/screenrec");
    assert.ok(!before[".claude/skills/screenrec/SKILL.md"]);
    await writeFile(join(root, ".agents/skills/screenrec/SKILL.md"), "changed");
    const after = await projectSnapshot(root);
    assert.notEqual(before[".agents/skills/screenrec/SKILL.md"].sha256, after[".agents/skills/screenrec/SKILL.md"].sha256);
    assert.deepEqual(before[".claude/settings.json"], after[".claude/settings.json"]);
  } finally { await rm(root, { recursive: true, force: true }); }
});
