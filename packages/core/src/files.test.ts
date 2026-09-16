import { test, expect } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  openSync,
  closeSync,
  fstatSync,
  readSync,
  renameSync,
  symlinkSync,
  rmSync,
  realpathSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { IdentifiedFiles, fileIdentity } from "./files.js";

function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "identified-files-")));
  mkdirSync(join(root, "owned"));
  mkdirSync(join(root, "external"));
  writeFileSync(join(root, "owned", "member"), "owned bytes");
  writeFileSync(join(root, "external", "member"), "foreign bytes");
  const fd = openSync(join(root, "owned", "member"), "r"),
    stat = fstatSync(fd, { bigint: true });
  closeSync(fd);
  const files = new IdentifiedFiles(
    root,
    [{ path: "owned/member", bytes: Number(stat.size), identity: fileIdentity(stat) }],
    1,
  );
  return {
    root,
    files,
    close() {
      files.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}
for (const replacement of ["regular", "symlink"] as const)
  test(`identity admission refuses ${replacement} ancestor replacement before reading`, () => {
    const f = fixture();
    try {
      renameSync(join(f.root, "owned"), join(f.root, "retained"));
      if (replacement === "regular") renameSync(join(f.root, "external"), join(f.root, "owned"));
      else symlinkSync(join(f.root, "external"), join(f.root, "owned"));
      expect(() => f.files.open("owned/member")).toThrow();
    } finally {
      f.close();
    }
  });
test("an admitted descriptor reads the original object after its locator is replaced", () => {
  const f = fixture();
  try {
    const file = f.files.open("owned/member");
    renameSync(join(f.root, "owned", "member"), join(f.root, "owned", "retained"));
    renameSync(join(f.root, "external", "member"), join(f.root, "owned", "member"));
    const bytes = Buffer.alloc(11);
    expect(readSync(file.fd, bytes, 0, bytes.length, 0)).toBe(11);
    expect(bytes.toString()).toBe("owned bytes");
    file.close();
    expect(() => f.files.open("owned/member")).toThrow();
  } finally {
    f.close();
  }
});
test("file admission is bounded and close revokes held leases without descriptor reuse", () => {
  const f = fixture();
  try {
    const first = f.files.open("owned/member");
    expect(() => f.files.open("owned/member")).toThrow("limit");
    first.close();
    const held = f.files.open("owned/member");
    f.files.stop();
    expect(() => f.files.open("owned/member")).toThrow("closed");
    expect(fstatSync(held.fd).isFile()).toBe(true);
    f.files.close();
    expect(() => held.fd).toThrow("closed");
    held.close();
    f.files.close();
  } finally {
    f.close();
  }
});

test("forgetting file authority waits for lease closure and releases its identity entry", () => {
  const f = fixture();
  let released = 0;
  try {
    const file = f.files.open("owned/member", false, () => released++);
    const stat = fstatSync(file.fd, { bigint: true });
    expect(() => f.files.forget("owned/member")).toThrow("active reads");
    expect(released).toBe(0);
    file.close();
    file.close();
    expect(released).toBe(1);
    f.files.forget("owned/member");
    expect(() => f.files.open("owned/member")).toThrow("not admitted");
    f.files.add({ path: "owned/member", bytes: Number(stat.size), identity: fileIdentity(stat) });
    const held = f.files.open("owned/member", false, () => released++);
    f.files.close();
    expect(released).toBe(2);
    expect(() => held.fd).toThrow("closed");
  } finally {
    f.close();
  }
});
