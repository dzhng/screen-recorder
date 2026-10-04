import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync, readlinkSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative as relativePath, sep } from "node:path";

export function frameworkIdentity(root) {
  root = realpathSync(root);
  const records = [];
  function visit(directory, prefix = "") {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name);
      const relative = prefix + name;
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) {
        const target = relativePath(root, realpathSync(path));
        if (isAbsolute(target) || target === ".." || target.startsWith(`..${sep}`))
          throw new Error(`Framework link resolves outside the framework: ${relative}`);
        records.push([relative, "link", readlinkSync(path)]);
      } else if (stat.isDirectory()) {
        records.push([relative, "directory", stat.mode & 0o777]);
        visit(path, relative + "/");
      } else if (stat.isFile()) {
        records.push([
          relative,
          "file",
          stat.mode & 0o777,
          createHash("sha256").update(readFileSync(path)).digest("hex"),
        ]);
      } else throw new Error(`Unsupported framework entry: ${relative}`);
    }
  }
  visit(root);
  return { sha256: createHash("sha256").update(JSON.stringify(records)).digest("hex") };
}
