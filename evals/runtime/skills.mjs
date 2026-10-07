import { readdir, readFile, readlink } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";

// Source mirrors replace acquisition only. Agents still execute the real installer.
export function skillCaseFiles(skill, fixture) {
  const files = Object.fromEntries(
    Object.entries(skill).map(([path, bytes]) => [`work/upstream/skills/yap/${path}`, bytes]),
  );
  files["work/.claude/settings.json"] = '{"fixtureUnrelatedSetting":true}\n';
  if (fixture !== "skill-install") {
    for (const [path, bytes] of Object.entries(skill))
      files[`work/.agents/skills/yap/${path}`] = bytes;
    files["work/.agents/skills/yap/SKILL.md"] =
      `${skill["SKILL.md"]}\nLOCAL CUSTOMIZATION: retain this user's recording preference.\n`;
    files["work/.agents/skills/yap/local-notes.md"] =
      "Local notes: preserve on surgical updates.\n";
    files["work/.agents/skills/yap/references/removed.md"] = "Deleted upstream reference.\n";
    files["work/upstream/skills/yap/references/added.md"] = "New upstream reference.\n";
  }
  if (fixture === "skill-provenance") {
    files["work/.agents/skills/yap/SKILL.md"] =
      "---\nname: yap\ndescription: Inspect recordings using Yap.\n---\n\n# Yap\n\nInspect the installed CLI before operating.\n";
    delete files["work/.agents/skills/yap/references/capability-discovery.md"];
    delete files["work/.agents/skills/yap/references/helper-examples.md"];
  }
  return files;
}

export async function projectSnapshot(root, textLimit = Infinity) {
  const result = {};
  async function walk(path, relative = "") {
    for (const entry of (await readdir(path, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      const absolute = join(path, entry.name);
      if (entry.isSymbolicLink())
        result[name] = { kind: "symlink", target: await readlink(absolute) };
      else if (entry.isDirectory()) await walk(absolute, name);
      else if (entry.isFile()) {
        const bytes = await readFile(absolute);
        const text = bytes.toString("utf8");
        result[name] = {
          kind: "file",
          sha256: createHash("sha256").update(bytes).digest("hex"),
          text:
            text.length <= textLimit
              ? text
              : `${text.slice(0, textLimit / 2)}\n<text excerpt; compare sha256 for complete bytes>\n${text.slice(-textLimit / 2)}`,
        };
      }
    }
  }
  await walk(root);
  return result;
}
